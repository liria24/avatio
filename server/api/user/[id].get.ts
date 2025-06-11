import { z } from 'zod/v4'

const params = z.object({
    id: z.uuid('Invalid UUID format'),
})

export default defineEventHandler(async () => {
    const { id } = await validateParams(params)

    const supabase = await getSupabaseServerClient()

    const { data, error } = await supabase
        .from('users')
        .select(
            `
            id, name, avatar, bio, links, created_at,
            badges:user_badges(created_at, name),
            shops:user_shops(shop:shop_id(id, name, thumbnail, verified))
            `
        )
        .eq('id', id!)
        .maybeSingle<User>()

    if (error) {
        console.error('Database error:', error)
        throw createError({
            statusCode: 500,
            message: `Database error: ${error.message}`,
        })
    }

    if (!data) {
        console.error(`User with ID ${id} not found`)
        throw createError({
            statusCode: 404,
            message: `User with ID ${id} not found`,
        })
    }

    return data
})
