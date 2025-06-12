import { z } from 'zod/v4'
import { checkSupabaseUser } from '~~/server/utils/checkSupabaseUser'

const params = z.object({
    id: z.union([z.number(), z.string().transform(Number)]),
})

export default defineEventHandler(async (event) => {
    try {
        // ユーザー認証チェック
        await checkSupabaseUser()

        const { id } = await validateParams(params)
        const supabase = await getSupabaseServerClient()

        // セットアップデータの取得
        const { data: setupData, error: fetchError } = await supabase
            .from('setups')
            .select('images:setup_images(name)')
            .eq('id', id)
            .maybeSingle()

        if (fetchError) {
            console.error('Failed to fetch setup data:', fetchError)
            throw createError({
                statusCode: 500,
                message: 'Failed to fetch setup data.',
            })
        }

        if (!setupData) {
            console.error(`Setup not found with ID: ${id}`)
            throw createError({
                statusCode: 404,
                message: 'Setup not found.',
            })
        }

        // セットアップの削除
        const { error: deleteError } = await supabase
            .from('setups')
            .delete()
            .eq('id', id)

        if (deleteError) {
            console.error('Failed to delete setup:', deleteError)
            throw createError({
                statusCode: 500,
                message: 'Failed to delete setup.',
            })
        }

        // 関連画像の削除
        const failed = []
        for (const image of setupData.images) {
            try {
                await event.$fetch(`/api/image`, {
                    method: 'DELETE',
                    query: { name: image.name, prefix: 'setup' },
                })
            } catch (error) {
                console.error(`Failed to delete image ${image.name}:`, error)
                failed.push(image.name)
            }
        }

        if (failed.length) {
            // 画像削除に失敗してもセットアップ自体は削除されているので、警告として200で返す
            setResponseStatus(event, 200)
            return {
                id: id,
                warning: `Successfully deleted setup, but failed to delete some images: ${failed.join(', ')}`,
            }
        }

        setResponseStatus(event, 204)
        return null
    } catch (error) {
        console.error('Error in setup deletion:', error)
        throw createError({
            statusCode: 500,
            message: 'An unexpected error occurred.',
        })
    }
})
