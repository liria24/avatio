import database from '@@/database'
import { items } from '@@/database/schema'
import { waitUntil } from '@vercel/functions'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    repo: z.string(),
})

const CACHE_DURATION_MS = 1000 * 60 * 60 // 1時間

const { adminKey } = useRuntimeConfig()

const markItemAsOutdated = async (id: string): Promise<void> => {
    try {
        await database
            .update(items)
            .set({ outdated: true, updatedAt: new Date() })
            .where(eq(items.id, id))
    } catch (error) {
        consola.error(`Failed to mark item ${id} as outdated:`, error)
    }
}

export default defineApi<Item>(
    async () => {
        let { repo } = await validateParams(params)
        repo = transformItemId(repo).decode()

        const { forceUpdateItem } = await getEdgeConfig()

        const cachedItem = forceUpdateItem
            ? null
            : await getItemFromDatabase(repo)

        const isCacheValid =
            cachedItem &&
            Date.now() - new Date(cachedItem.updatedAt).getTime() <
                CACHE_DURATION_MS

        if (isCacheValid && !cachedItem.outdated) return cachedItem
        if (isCacheValid && cachedItem.outdated)
            throw new Error('Item not found or not allowed')

        const item = await getGithubItem(repo)

        if (!item) {
            if (cachedItem) markItemAsOutdated(cachedItem.id)
            throw new Error('Repository not found')
        }

        // DBに無いあるいはforceUpdateItemがtrueの場合はniceNameとcategoryをAI生成
        waitUntil(
            (async () => {
                if (cachedItem && cachedItem.id !== item.id)
                    await database
                        .update(items)
                        .set({ id: item.id })
                        .where(eq(items.id, cachedItem.id))

                await database
                    .insert(items)
                    .values({
                        id: item.id,
                        platform: item.platform,
                        name: item.name,
                        category: item.category,
                    })
                    .onConflictDoUpdate({
                        target: items.id,
                        set: {
                            ...item,
                            updatedAt: new Date(),
                            outdated: false,
                        },
                    })

                if (!cachedItem)
                    try {
                        consola.log(`Defining item info for item ${item.id}`)

                        const repoData = await getGithubRepo(repo)
                        const readme = await getGithubReadme(repo)
                        const description = {
                            description: repoData?.repo.description || '',
                            readme: readme?.markdown || '',
                        }

                        const { niceName, category } = await $fetch(
                            '/api/items/generate',
                            {
                                method: 'POST',
                                headers: {
                                    authorization: `Bearer ${adminKey}`,
                                },
                                body: {
                                    name: item.name,
                                    description,
                                    category: item.category,
                                },
                            }
                        )

                        await database
                            .update(items)
                            .set({ niceName, category })
                            .where(eq(items.id, item.id))

                        consola.log(
                            `Item info defined for item ${item.id}: ${niceName}, ${category}`
                        )
                    } catch (error) {
                        consola.error(
                            `Failed to define item info for item ${item.id}:`,
                            error
                        )
                    }
            })()
        )

        return item
    },
    {
        errorMessage: 'Failed to get github item.',
    }
)
