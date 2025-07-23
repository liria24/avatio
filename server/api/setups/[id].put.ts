import database from '@@/database'
import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = setupsUpdateSchema

export default defineApi<Setup>(
    async ({ session }) => {
        const { id } = await validateParams(params)

        // セットアップの存在確認と権限チェック
        const existingSetup = await database
            .select({ userId: setups.userId })
            .from(setups)
            .where(eq(setups.id, id))
            .limit(1)

        if (!existingSetup.length)
            throw createError({
                statusCode: 404,
                statusMessage: 'Setup not found',
            })

        if (existingSetup[0].userId !== session!.user.id)
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied',
            })

        const { name, description, items, images, tags, coauthors } =
            await validateBody(body, { sanitize: true })

        // セットアップ基本情報の更新
        const updateData: Partial<
            Pick<
                typeof setups.$inferInsert,
                'name' | 'description' | 'updatedAt'
            >
        > = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        updateData.updatedAt = new Date()

        if (Object.keys(updateData).length > 0)
            await database
                .update(setups)
                .set(updateData)
                .where(eq(setups.id, id))

        // アイテムの更新
        // 既存のアイテムとシェイプキーを削除
        await database
            .delete(setupItemShapekeys)
            .where(
                inArray(
                    setupItemShapekeys.setupItemId,
                    database
                        .select({ id: setupItems.id })
                        .from(setupItems)
                        .where(eq(setupItems.setupId, id))
                )
            )

        await database.delete(setupItems).where(eq(setupItems.setupId, id))

        // 新しいアイテムを挿入
        if (items.length) {
            const insertedItems = await database
                .insert(setupItems)
                .values(
                    items.map((item) => ({
                        setupId: id,
                        itemId: item.itemId,
                        category: item.category,
                        note: item.note,
                        unsupported:
                            item.category === 'avatar'
                                ? false
                                : item.unsupported,
                    }))
                )
                .returning({
                    id: setupItems.id,
                    itemId: setupItems.itemId,
                })

            // シェイプキーの挿入
            if (items.some((item) => item.shapekeys?.length)) {
                const shapekeys = items.flatMap((item, index) => {
                    const setupItemId = insertedItems[index].id
                    return (
                        item.shapekeys?.map((shapekey) => ({
                            setupItemId,
                            name: shapekey.name,
                            value: shapekey.value,
                        })) || []
                    )
                })

                if (shapekeys.length)
                    await database.insert(setupItemShapekeys).values(shapekeys)
            }
        }

        // 画像の更新
        if (images !== undefined) {
            await database
                .delete(setupImages)
                .where(eq(setupImages.setupId, id))

            if (images.length) {
                const imageData = await Promise.all(
                    images.map(async (image) => {
                        const { colors, width, height } =
                            await extractImageColors(image)
                        return {
                            setupId: id,
                            url: image,
                            width,
                            height,
                            themeColors: colors.length ? colors : null,
                        }
                    })
                )

                await database.insert(setupImages).values(imageData)
            }
        }

        // タグの更新
        if (tags !== undefined) {
            await database.delete(setupTags).where(eq(setupTags.setupId, id))

            if (tags.length)
                await database.insert(setupTags).values(
                    tags.map((tag) => ({
                        setupId: id,
                        tag: tag.tag,
                    }))
                )
        }

        // 共同作者の更新
        if (coauthors !== undefined) {
            await database
                .delete(setupCoauthors)
                .where(eq(setupCoauthors.setupId, id))

            if (coauthors.length > 0)
                await database.insert(setupCoauthors).values(
                    coauthors.map((coauthor) => ({
                        setupId: id,
                        userId: coauthor.userId,
                        note: coauthor.note,
                    }))
                )
        }

        const data = await useEvent().$fetch(`/api/setups/${id}`)

        return data
    },
    {
        errorMessage: 'Failed to update setup.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
