import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.number(), z.string().transform(Number)]),
})

export default defineEventHandler(async (): Promise<SetupClient> => {
    const { id } = await validateParams(params)
    const supabase = await getSupabaseServerClient()

    const { data } = await supabase
        .from('setups')
        .select(
            `
            id,
            created_at,
            name,
            description,
            unity,
            author(
                id,
                name,
                avatar,
                badges:user_badges(
                    created_at,
                    name
                )
            ),
            images:setup_images(
                name,
                width,
                height
            ),
            items:setup_items(
                data:item_id(
                    id,
                    updated_at,
                    outdated,
                    category,
                    name,
                    thumbnail,
                    price,
                    likes,
                    shop:shop_id(
                        id,
                        name,
                        thumbnail,
                        verified
                    ),
                    nsfw,
                    source
                ),
                note,
                unsupported,
                category,
                shapekeys:setup_item_shapekeys(
                    name,
                    value
                )
            ),
            tags:setup_tags(tag),
            co_authors:setup_coauthors(
                user:user_id(
                    id,
                    name,
                    avatar,
                    badges:user_badges(
                        created_at,
                        name
                    )
                ),
                note
            )
            `
        )
        .eq('id', id)
        .maybeSingle<SetupDB>()

    if (!data) {
        console.error(`Setup not found: ID=${id}`)
        throw createError({
            statusCode: 404,
            message: 'Setup not found.',
        })
    }

    // アイテム情報の更新処理
    await updateItemsIfNeeded(data.items)

    return setupMoldingClient(data)
})

// アイテム情報が古い場合に更新する関数
const updateItemsIfNeeded = async (
    items: {
        data: Item | null
        note: string
        unsupported: boolean
        category: ItemCategory | null
        shapekeys: Shapekey[]
    }[]
) => {
    if (!items?.length) return

    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    const currentTime = Date.now()

    for (const item of items) {
        if (!item.data) continue

        const updatedAt = new Date(item.data.updated_at).getTime()
        if (currentTime - updatedAt <= ONE_DAY_MS) continue

        try {
            // boothアイテム情報を取得
            const response = await useEvent().$fetch('/api/item/booth', {
                query: { id: item.data.id },
            })

            if (response) {
                // 取得したデータでアイテム情報を更新
                item.data = {
                    ...response,
                    updated_at: new Date().toISOString(),
                }
            } else {
                // 情報取得できなかった場合はoutdatedフラグを立てる
                item.data.outdated = true
            }
        } catch (error) {
            console.error(`Failed to update item ${item.data.id}:`, error)
        }
    }
}
