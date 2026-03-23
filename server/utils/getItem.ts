import { items, shops } from '@@/database/schema'
import { waitUntil } from '@vercel/functions'
import { eq } from 'drizzle-orm'
import { joinURL, withHttps } from 'ufo'

const log = logger('getItem')

const markItemAsOutdated = async (id: string): Promise<void> => {
    try {
        await db
            .update(items)
            .set({ outdated: true, updatedAt: new Date() })
            .where(eq(items.id, id))
    } catch (error) {
        log.error(`Failed to mark item ${id} as outdated:`, error)
    }
}

const assignItemAttr = async (
    id: string,
    params: {
        name: string
        description?: string | { description: string; readme: string }
        category?: string
    },
) => {
    try {
        log.log(`Defining item info for item ${id}`)
        const { niceName, category } = await generateItemAttr(params)
        await db.update(items).set({ niceName, category }).where(eq(items.id, id))
        log.log(`Item info defined for item ${id}: ${niceName}, ${category}`)
    } catch (error) {
        log.error(`Failed to define item info for item ${id}:`, error)
    }
}

const updateBoothDatabase = async (
    item: Item & { shop: NonNullable<Item['shop']> },
): Promise<void> => {
    try {
        await db
            .insert(shops)
            .values({
                id: item.shop.id,
                platform: item.shop.platform,
                name: item.shop.name,
                image: item.shop.image,
                verified: item.shop.verified,
            })
            .onConflictDoUpdate({
                target: shops.id,
                set: {
                    name: item.shop.name,
                    image: item.shop.image,
                    verified: item.shop.verified,
                },
            })

        const itemData = {
            id: item.id,
            name: item.name,
            image: item.image,
            category: item.category,
            price: item.price,
            likes: item.likes,
            nsfw: item.nsfw,
            platform: item.platform,
            shopId: item.shop.id,
        }

        await db
            .insert(items)
            .values(itemData)
            .onConflictDoUpdate({
                target: items.id,
                set: {
                    ...itemData,
                    updatedAt: new Date(),
                    outdated: false,
                },
            })
    } catch (error) {
        log.error(`Failed to update database for item ${item.id}:`, error)
        throw error
    }
}

const getBoothItem = async (id: string): Promise<Item> => {
    const { forceUpdateItem, allowedBoothCategoryId, specificItemCategories } =
        await getEdgeConfig()

    const cachedItem = forceUpdateItem ? null : await getItemFromDatabase(id)

    if (
        cachedItem &&
        Date.now() - new Date(cachedItem.updatedAt).getTime() < ITEM_CACHE_DURATION_MS
    ) {
        if (cachedItem.outdated) throw new Error('Item not found or not allowed')
        return cachedItem
    }

    let item: Booth | null = null
    try {
        item = await $fetch<Booth>(`/${id}.json`, {
            baseURL: joinURL(withHttps(BOOTH_BASE_DOMAIN), 'ja/items'),
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        log.error(`Failed to fetch booth item ${id}:`, error)
    }

    if (!item || !allowedBoothCategoryId.includes(item.category.id)) {
        if (cachedItem) await markItemAsOutdated(id)
        throw new Error('Item not found or not allowed')
    }

    const category: ItemCategory =
        specificItemCategories['booth'][item.id] || BOOTH_CATEGORY_MAP[item.category.id] || 'other'

    const processedItem = {
        id: item.id,
        platform: 'booth' as const,
        category,
        name: item.name,
        niceName: cachedItem?.niceName || null,
        image: item.images[0]?.original || '',
        price: item.variations.some((v) => v.status === 'free_download') ? 'FREE' : item.price,
        likes: Number(item.wish_lists_count) || 0,
        nsfw: Boolean(item.is_adult),
        shop: {
            id: item.shop.subdomain,
            platform: 'booth' as const,
            name: item.shop.name,
            image: item.shop.thumbnail_url || '',
            verified: Boolean(item.shop.verified),
        },
        outdated: false,
    }

    waitUntil(
        updateBoothDatabase(processedItem).then(() => {
            if (!cachedItem)
                return assignItemAttr(id, {
                    name: item.name,
                    description: item.description || undefined,
                    category: processedItem.category,
                })
        }),
    )

    return processedItem
}

const getGithubItemFromRepo = async (repo: string): Promise<Item> => {
    const { forceUpdateItem } = await getEdgeConfig()

    const cachedItem = forceUpdateItem ? null : await getItemFromDatabase(repo)

    if (
        cachedItem &&
        Date.now() - new Date(cachedItem.updatedAt).getTime() < GITHUB_ITEM_CACHE_DURATION_MS
    ) {
        if (cachedItem.outdated) throw new Error('Item not found or not allowed')
        return cachedItem
    }

    const item = await getGithubItem(repo)

    if (!item) {
        if (cachedItem) waitUntil(markItemAsOutdated(cachedItem.id))
        throw new Error('Repository not found')
    }

    waitUntil(
        (async () => {
            if (cachedItem && cachedItem.id !== item.id)
                await db.update(items).set({ id: item.id }).where(eq(items.id, cachedItem.id))

            await db
                .insert(items)
                .values({
                    id: item.id,
                    platform: item.platform,
                    name: item.name,
                    niceName: cachedItem?.niceName || item.niceName,
                    category: cachedItem?.category || item.category,
                })
                .onConflictDoUpdate({
                    target: items.id,
                    set: {
                        ...item,
                        updatedAt: new Date(),
                        outdated: false,
                    },
                })

            if (!cachedItem) {
                const repoData = await getGithubRepo(repo)
                const readme = await getGithubReadme(repo)
                await assignItemAttr(item.id, {
                    name: item.name,
                    description: {
                        description: repoData?.repo.description || '',
                        readme: readme?.markdown || '',
                    },
                    category: item.category,
                })
            }
        })(),
    )

    return item
}

export default async (provider: 'booth' | 'github', id: string | number): Promise<Item> => {
    if (provider === 'booth') return getBoothItem(String(id))
    if (provider === 'github') return getGithubItemFromRepo(String(id))
    throw new Error(`Unsupported provider: ${provider}`)
}
