import { items, shops } from '@@/database/schema'
import {
    getGithubContributors,
    getGithubLatestRelease,
    getGithubReadme,
    getGithubRepo,
} from '@avatio/ungh'
import { waitUntil } from '@vercel/functions'
import { eq } from 'drizzle-orm'
import { joinURL, withHttps } from 'ufo'

const log = logger('getItem')

export default async (provider: Platform | undefined, id: string): Promise<Item> => {
    const { forceUpdateItem, allowedBoothCategoryId, specificItemCategories } =
        await getEdgeConfig()

    const { fresh, cachedItem } = await resolveItemCache(provider, id, forceUpdateItem)
    if (fresh) return fresh

    const resolvedProvider = provider ?? cachedItem?.platform
    if (!resolvedProvider)
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })

    if (resolvedProvider === 'booth') {
        const item = await $fetch<Booth | null>(`/${id}.json`, {
            baseURL: joinURL(withHttps(BOOTH_BASE_DOMAIN), 'ja/items'),
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
            ignoreResponseError: true,
            onResponseError({ error }) {
                log.error(`Failed to fetch booth item ${id}:`, error)
            },
        })

        const validItem = item && allowedBoothCategoryId.includes(item.category.id) ? item : null

        return persistItem(
            validItem
                ? {
                      valid: true,
                      item: {
                          id: validItem.id,
                          platform: 'booth' as const,
                          name: validItem.name,
                          niceName: cachedItem?.niceName || null,
                          image: validItem.images[0]?.original || '',
                          price: validItem.variations.some((v) => v.status === 'free_download')
                              ? 'FREE'
                              : validItem.price,
                          likes: Number(validItem.wish_lists_count) || 0,
                          nsfw: Boolean(validItem.is_adult),
                          shopId: validItem.shop.subdomain,
                          outdated: false,
                      },
                      shop: {
                          id: validItem.shop.subdomain,
                          platform: 'booth' as const,
                          name: validItem.shop.name,
                          image: validItem.shop.thumbnail_url || '',
                          verified: Boolean(validItem.shop.verified),
                      },
                      cachedItem,
                      specificItemCategories,
                      categoryFallback: BOOTH_CATEGORY_MAP[validItem.category.id] ?? 'other',
                      assignAttrParams: {
                          name: validItem.name,
                          description: validItem.description
                              ? { description: validItem.description }
                              : undefined,
                      },
                  }
                : { valid: false, cachedItem },
        )
    }

    if (resolvedProvider === 'github') {
        const [repoData, contributors, latestRelease, readme] = await Promise.all([
            getGithubRepo(id),
            getGithubContributors(id),
            getGithubLatestRelease(id),
            getGithubReadme(id),
        ])

        const owner = repoData?.repo.repo.split('/')[0]

        return {
            ...persistItem(
                repoData && owner
                    ? {
                          valid: true,
                          item: {
                              id: repoData.repo.repo,
                              platform: 'github' as const,
                              name: repoData.repo.name,
                              outdated: false as const,
                              image: null,
                              niceName: null,
                              price: null,
                              nsfw: false as const,
                              likes: repoData.repo.stars,
                              shopId: owner,
                          },
                          shop: {
                              id: owner,
                              platform: 'github' as const,
                              name: owner,
                              image: `https://github.com/${owner}.png`,
                              verified: false,
                          },
                          cachedItem,
                          specificItemCategories,
                          categoryFallback: cachedItem?.category ?? 'other',
                          assignAttrParams: {
                              name: repoData.repo.name,
                              description: {
                                  description: repoData.repo.description || '',
                                  readme: readme?.markdown || '',
                              },
                          },
                          idMigration:
                              cachedItem && cachedItem.id !== repoData.repo.repo
                                  ? { from: cachedItem.id, to: repoData.repo.repo }
                                  : undefined,
                      }
                    : { valid: false, cachedItem },
            ),
            forks: repoData?.repo.forks,
            version: latestRelease?.release.tag,
            contributors: contributors?.contributors
                .sort((a, b) => b.contributions - a.contributions)
                .map((c) => ({ name: c.username, contributions: c.contributions })),
        }
    }

    throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })
}

type PersistItemParams =
    | {
          valid: true
          item: Omit<typeof items.$inferInsert, 'category' | 'id' | 'platform' | 'name'> & {
              id: string
              platform: 'booth' | 'github'
              name: string
          }
          shop: Omit<typeof shops.$inferInsert, 'id' | 'platform' | 'name'> & {
              id: string
              platform: 'booth' | 'github'
              name: string
          }
          cachedItem: { id: string } | null
          specificItemCategories: EdgeConfig['specificItemCategories']
          categoryFallback: ItemCategory
          assignAttrParams: Omit<GenerateItemAttrParams, 'originalCategory'>
          idMigration?: { from: string; to: string }
      }
    | { valid: false; cachedItem: { id: string } | null }

export const persistItem = (params: PersistItemParams): Item => {
    if (!params.valid) {
        if (params.cachedItem)
            waitUntil(
                db.update(items).set({ outdated: true }).where(eq(items.id, params.cachedItem.id)),
            )
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })
    }

    const {
        item,
        shop,
        cachedItem,
        specificItemCategories,
        categoryFallback,
        assignAttrParams,
        idMigration,
    } = params

    const category = specificItemCategories[item.platform]?.[item.id] ?? categoryFallback
    const fullItem = { ...item, category }

    const persist = async () => {
        await db.transaction(async (tx) => {
            if (idMigration)
                await tx
                    .update(items)
                    .set({ id: idMigration.to })
                    .where(eq(items.id, idMigration.from))

            await tx.insert(shops).values(shop).onConflictDoUpdate({ target: shops.id, set: shop })
            await tx
                .insert(items)
                .values(fullItem)
                .onConflictDoUpdate({ target: items.id, set: fullItem })
        })

        if (!cachedItem) {
            const { niceName, category: resolvedCategory } = await generateItemAttr({
                ...assignAttrParams,
                originalCategory: category,
            })
            await db
                .update(items)
                .set({ niceName, category: resolvedCategory })
                .where(eq(items.id, item.id))
            log.info(`Item info defined for item ${item.id}: ${niceName}, ${resolvedCategory}`)
        }
    }

    waitUntil(persist())

    return {
        id: item.id,
        platform: item.platform,
        category,
        name: item.name,
        niceName: fullItem.niceName ?? null,
        image: fullItem.image ?? null,
        price: fullItem.price ?? null,
        likes: fullItem.likes ?? null,
        nsfw: fullItem.nsfw ?? false,
        outdated: fullItem.outdated ?? false,
        shop: {
            id: shop.id,
            platform: shop.platform,
            name: shop.name,
            image: shop.image ?? null,
            verified: shop.verified ?? false,
        },
    }
}

export const resolveItemCache = async (
    category: Platform | undefined,
    id: string,
    forceUpdate: boolean,
) => {
    if (forceUpdate) return { fresh: null, cachedItem: null }

    const cachedItem =
        (await db.query.items.findFirst({
            where: {
                id: { eq: id },
            },
            columns: {
                id: true,
                updatedAt: true,
                name: true,
                niceName: true,
                image: true,
                category: true,
                price: true,
                likes: true,
                nsfw: true,
                outdated: true,
                platform: true,
            },
            with: {
                shop: {
                    columns: {
                        id: true,
                        platform: true,
                        name: true,
                        image: true,
                        verified: true,
                    },
                },
            },
        })) || null

    if (cachedItem?.outdated)
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })

    const resolvedCategory = category ?? cachedItem?.platform

    const maxAgeMs = {
        booth: ITEM_CACHE_DURATION_MS,
        github: GITHUB_ITEM_CACHE_DURATION_MS,
    }

    const fresh =
        resolvedCategory &&
        cachedItem &&
        Date.now() - new Date(cachedItem.updatedAt).getTime() < maxAgeMs[resolvedCategory]
            ? cachedItem
            : null

    return { fresh, cachedItem }
}
