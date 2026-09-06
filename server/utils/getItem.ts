import { and, eq, inArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { H3Event } from 'h3'
import { joinURL, withHttps } from 'ufo'
import { itemCategoryOverrides, items, shops } from '~~/database/schema'
import {
    buildCatalogCompatibilityStatements,
    markCatalogCompatibilityWithdrawal,
    updateCatalogCompatibilityEnrichment,
} from '~~/server/migration/catalog/compatibility'

const log = logger('getItem')
const UNGH_URL = 'https://ungh.cc'

interface GithubRepoResponse {
    repo: {
        name: string
        repo: string
        description: string
        stars: number
        forks: number
    }
}

interface GithubContributorsResponse {
    contributors: { username: string; contributions: number }[]
}

interface GithubLatestReleaseResponse {
    release: { tag: string }
}

interface GithubReadmeResponse {
    markdown: string
}

interface GetItemOptions {
    allowExternalResolution?: boolean
    beforeExternalResolution?: () => Promise<void>
    forceRefresh?: boolean
}

const getGithubResource = <T>(repo: string, path = ''): Promise<T | null> => {
    if (!/^[\w-]+\/[\w.-]+$/.test(repo)) return Promise.resolve(null)
    return $fetch<T>(`${UNGH_URL}/repos/${repo}${path}`).catch(() => null)
}

/**
 * Temporary legacy Catalog resolver retained for rollout compatibility.
 * Canonical v2 provider resolution and source synchronization live behind the Catalog adapters.
 */
export default async (
    event: H3Event | undefined,
    db: ReturnType<typeof useDB>,
    id: string,
    provider: Platform | undefined,
    options: GetItemOptions = {},
): Promise<Item> => {
    const persistence = {
        defer: Boolean(event),
        purge: event
            ? (catalogItemId?: string) =>
                  invalidateCacheResources(
                      event,
                      {
                          items: catalogItemId ? [catalogItemId] : undefined,
                          collections: [EDGE_CACHE_TAGS.items],
                      },
                      'item persistence',
                  )
            : () => Promise.resolve(),
    }

    if (!options.allowExternalResolution) {
        const { cachedItem } = await resolveItemCache(db, id, provider, false)
        if (cachedItem) return cachedItem
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })
    }

    const forceRefresh = options.forceRefresh === true

    const { fresh, cachedItem, revalidationDue } = await resolveItemCache(
        db,
        id,
        provider,
        forceRefresh,
    )
    if (fresh) return fresh

    if (cachedItem && !revalidationDue)
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })

    const resolvedProvider = provider ?? cachedItem?.platform
    if (!resolvedProvider)
        throw serverError.notFound({ responseMessage: 'Item not found or not allowed' })

    const admission = await getItemAdmission(db, resolvedProvider, id)
    const allowedBoothCategoryId = admission.allowedBoothCategories

    await options.beforeExternalResolution?.()

    log.info(`Processing item: ${id}, Platform: ${resolvedProvider}, force=${forceRefresh}`)

    if (resolvedProvider === 'booth') {
        const proxyUrl = getRuntimeEnvString('BOOTH_PROXY_URL', event)

        if (!proxyUrl)
            throw serverError.internalServerError({
                log: {
                    tag: 'getItem',
                    message: 'Missing BOOTH proxy URL binding.',
                },
                responseMessage: 'BOOTH proxy is not configured',
            })

        const boothProxyUrl = joinURL(withHttps(proxyUrl), id)

        const response = await $fetch.raw<Booth | null>(boothProxyUrl, {
            ignoreResponseError: true,
        })

        if (response.status === 404 || response.status === 410) {
            const reason = response.status === 410 ? 'provider-gone' : 'provider-not-found'

            return await persistItem(
                db,
                {
                    valid: false,
                    cachedItem,
                    error: new PermanentItemResolutionError(
                        `BOOTH item ${id} returned ${response.status}`,
                        reason,
                    ),
                },
                persistence,
            )
        }

        if (!response.ok)
            throw serverError.internalServerError({
                log: {
                    tag: 'getItem',
                    message: `BOOTH proxy returned ${response.status} for item ${id}`,
                },
                responseMessage: 'Failed to fetch BOOTH item',
            })

        const item = response._data

        if (!item)
            throw serverError.internalServerError({
                log: {
                    tag: 'getItem',
                    message: `BOOTH proxy returned an empty successful response for item ${id}`,
                },
                responseMessage: 'Invalid BOOTH proxy response',
            })

        log.info(`Resolved BOOTH item ${id}: category=${item.category.id}`)

        if (!allowedBoothCategoryId.includes(item.category.id))
            throw new PermanentItemResolutionError(
                `BOOTH item ${id} has disallowed category ${item.category.id}`,
                'policy-rejected',
            )

        return await persistItem(
            db,
            {
                valid: true,
                item: {
                    id: item.id,
                    platform: 'booth' as const,
                    name: item.name,
                    niceName: cachedItem?.niceName || null,
                    image: item.images[0]?.original || '',
                    price: item.variations.some((v) => v.status === 'free_download')
                        ? 'FREE'
                        : item.price,
                    likes: Number(item.wish_lists_count) || 0,
                    nsfw: Boolean(item.is_adult),
                    shopId: item.shop.subdomain,
                    outdated: false,
                },
                shop: {
                    id: item.shop.subdomain,
                    platform: 'booth' as const,
                    name: item.shop.name,
                    image: item.shop.thumbnail_url || '',
                    verified: Boolean(item.shop.verified),
                },
                cachedItem,
                categoryOverride: admission.override,
                categoryFallback: BOOTH_CATEGORY_MAP[item.category.id] ?? 'other',
                providerCategory: {
                    rawKey: String(item.category.id),
                    rawLabel: item.category.name,
                    mappedCategory: BOOTH_CATEGORY_MAP[item.category.id] ?? null,
                },
                sourceMetadata: { description: item.description, tags: item.tags },
                assignAttrParams: {
                    name: item.name,
                    description: item.description ? { description: item.description } : undefined,
                },
            },
            persistence,
        )
    }

    if (resolvedProvider === 'github') {
        const [repoData, contributors, latestRelease, readme] = await Promise.all([
            getGithubResource<GithubRepoResponse>(id),
            getGithubResource<GithubContributorsResponse>(id, '/contributors'),
            getGithubResource<GithubLatestReleaseResponse>(id, '/releases/latest'),
            getGithubResource<GithubReadmeResponse>(id, '/readme'),
        ])

        const owner = repoData?.repo.repo.split('/')[0]

        return {
            ...(await persistItem(
                db,
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
                          categoryOverride: admission.override,
                          categoryFallback: cachedItem?.category ?? 'other',
                          providerCategory: null,
                          sourceMetadata: {
                              description: repoData.repo.description || '',
                              readme: readme?.markdown || '',
                              forks: repoData.repo.forks,
                              version: latestRelease?.release.tag,
                              contributors:
                                  contributors?.contributors.map((contributor) => ({
                                      name: contributor.username,
                                      contributions: contributor.contributions,
                                  })) ?? [],
                          },
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
                persistence,
            )),
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
          categoryOverride?: ItemCategory
          categoryFallback: ItemCategory
          providerCategory?: {
              rawKey: string
              rawLabel?: string
              mappedCategory: ItemCategory | null
          } | null
          sourceMetadata?: Record<string, unknown>
          assignAttrParams: Omit<GenerateItemAttrParams, 'originalCategory' | 'sourceId'>
          idMigration?: { from: string; to: string }
      }
    | {
          valid: false
          cachedItem: { id: string; platform?: Platform } | null
          error?: Error
      }

interface PersistenceOptions {
    defer: boolean
    purge: (catalogItemId?: string) => Promise<void>
}

export const persistItem = async (
    db: ReturnType<typeof useDB>,
    params: PersistItemParams,
    options: PersistenceOptions,
): Promise<Item> => {
    if (!params.valid) {
        if (params.cachedItem) {
            const cachedItemId = params.cachedItem.id
            const persist = async () => {
                await db.update(items).set({ outdated: true }).where(eq(items.id, cachedItemId))
                const catalogItemId =
                    params.error instanceof PermanentItemResolutionError &&
                    params.error.reason !== 'policy-rejected' &&
                    params.cachedItem?.platform
                        ? await markCatalogCompatibilityWithdrawal(db, {
                              providerKey: params.cachedItem.platform,
                              externalId: cachedItemId,
                              errorKind: params.error.reason,
                          })
                        : undefined
                await options.purge(catalogItemId)
            }

            if (options.defer) runAfterResponse(persist())
            else await persist()
        }
        throw (
            params.error ??
            serverError.notFound({
                responseMessage: 'Item not found or not allowed',
            })
        )
    }

    const {
        item,
        shop,
        cachedItem,
        categoryOverride,
        categoryFallback,
        providerCategory,
        sourceMetadata,
        assignAttrParams,
        idMigration,
    } = params

    const migratedOverrides = idMigration
        ? await db
              .select({
                  itemId: itemCategoryOverrides.itemId,
                  category: itemCategoryOverrides.category,
              })
              .from(itemCategoryOverrides)
              .where(
                  and(
                      eq(itemCategoryOverrides.platform, item.platform),
                      inArray(itemCategoryOverrides.itemId, [idMigration.from, idMigration.to]),
                  ),
              )
        : []
    const oldOverride = migratedOverrides.find(({ itemId }) => itemId === idMigration?.from)
    const newOverride = migratedOverrides.find(({ itemId }) => itemId === idMigration?.to)

    const category =
        newOverride?.category ?? categoryOverride ?? oldOverride?.category ?? categoryFallback
    const fullItem = { ...item, category }
    const manualCategory = newOverride?.category ?? categoryOverride ?? oldOverride?.category
    const catalogWrite = await buildCatalogCompatibilityStatements(db, {
        providerKey: item.platform,
        externalId: item.id,
        previousExternalId: idMigration?.from,
        name: item.name,
        image: item.image ?? null,
        price: item.price ?? null,
        popularityCount: item.likes ?? null,
        nsfw: item.nsfw ?? false,
        displayNameOverride: item.niceName,
        categoryOverride: manualCategory,
        categoryOverrideOrigin: manualCategory ? 'manual' : undefined,
        providerCategory,
        metadata: sourceMetadata,
        publisher: {
            externalId: shop.id,
            name: shop.name,
            image: shop.image ?? null,
            providerVerified: shop.verified ?? false,
        },
    })

    const persist = async () => {
        const queries: BatchItem<'sqlite'>[] = []
        if (idMigration)
            queries.push(
                db.update(items).set({ id: idMigration.to }).where(eq(items.id, idMigration.from)),
            )

        if (idMigration && oldOverride && !newOverride)
            queries.push(
                db
                    .insert(itemCategoryOverrides)
                    .values({
                        platform: item.platform,
                        itemId: idMigration.to,
                        category: oldOverride.category,
                    })
                    .onConflictDoNothing(),
            )
        if (idMigration && oldOverride)
            queries.push(
                db
                    .delete(itemCategoryOverrides)
                    .where(
                        and(
                            eq(itemCategoryOverrides.platform, item.platform),
                            eq(itemCategoryOverrides.itemId, idMigration.from),
                        ),
                    ),
            )

        queries.push(
            db.insert(shops).values(shop).onConflictDoUpdate({ target: shops.id, set: shop }),
            db
                .insert(items)
                .values(fullItem)
                .onConflictDoUpdate({ target: items.id, set: fullItem }),
            ...catalogWrite.statements,
        )
        await executeD1Batch(db, queries)
        await options.purge(catalogWrite.catalogItemId)

        if (!cachedItem) {
            const { niceName, category: resolvedCategory } = await generateItemAttr(db, {
                ...assignAttrParams,
                sourceId: catalogWrite.sourceId,
                originalCategory: category,
            })
            await db
                .update(items)
                .set({ niceName, category: resolvedCategory })
                .where(eq(items.id, item.id))
            await updateCatalogCompatibilityEnrichment(db, {
                providerKey: item.platform,
                externalId: item.id,
                displayNameOverride: niceName,
                categoryOverride: manualCategory ? undefined : resolvedCategory,
            })
            await options.purge(catalogWrite.catalogItemId)
            log.info(`Item info defined for item ${item.id}: ${niceName}, ${resolvedCategory}`)
        }
    }

    if (options.defer) runAfterResponse(persist())
    else await persist()

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
    db: ReturnType<typeof useDB>,
    id: string,
    platform: Platform | undefined,
    forceUpdate: boolean,
) => {
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

    const resolvedPlatform = platform ?? cachedItem?.platform

    const maxAgeMs = resolvedPlatform
        ? resolvedPlatform === 'github'
            ? GITHUB_ITEM_CACHE_DURATION_MS
            : ITEM_CACHE_DURATION_MS
        : undefined

    const age =
        cachedItem && maxAgeMs !== undefined
            ? Date.now() - new Date(cachedItem.updatedAt).getTime()
            : undefined

    const revalidationDue =
        forceUpdate ||
        !cachedItem ||
        (age !== undefined && maxAgeMs !== undefined && age >= maxAgeMs)

    const fresh =
        !forceUpdate && cachedItem && !cachedItem.outdated && !revalidationDue ? cachedItem : null

    return {
        fresh,
        cachedItem,
        revalidationDue,
    }
}
