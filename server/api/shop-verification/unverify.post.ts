import { z } from 'zod/v4'

const body = z.object({
    shopId: z.string('Shop ID is required').min(1, 'Shop ID cannot be empty'),
})

export default defineEventHandler(async () => {
    try {
        const { shopId } = await validateBody(body)

        const { id: userId } = await checkSupabaseUser()
        const supabase = await getSupabaseServiceRoleClient()

        const { data, error: deleteError } = await supabase
            .from('user_shops')
            .delete()
            .eq('user_id', userId)
            .eq('shop_id', shopId)
            .select()
            .maybeSingle()

        if (deleteError) {
            console.error('Error deleting user shop:', deleteError)
            throw createError({
                statusCode: 500,
                message: 'Error occurred while deleting shop association',
            })
        }

        if (!data) {
            console.error('Shop not found or not owned by the user')
            throw createError({
                statusCode: 404,
                message: 'Shop not found or not owned by the user',
            })
        }

        // ユーザーの他のショップをチェック
        const { data: userShops, error: selectError } = await supabase
            .from('user_shops')
            .select('id')
            .eq('user_id', userId)

        if (selectError) {
            console.error('Error checking user shops:', selectError)
            throw createError({
                statusCode: 500,
                message: 'Failed to retrieve user shop information',
            })
        }

        // 他のショップがなければバッジも削除
        if (!userShops?.length) {
            const { error: badgeError } = await supabase
                .from('user_badges')
                .delete()
                .eq('user_id', userId)
                .eq('name', 'shop_owner')

            if (badgeError) {
                console.error('Error removing shop owner badge:', badgeError)
            }
        }

        setResponseStatus(useEvent(), 204)
        return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error?.statusCode) throw error

        console.error('Unexpected error in unverify:', error)
        throw createError({
            statusCode: 500,
            message: 'An unexpected error occurred',
        })
    }
})
