import { serverSupabaseUser } from '#supabase/server'

export const checkSupabaseUser = async () => {
    const user = await serverSupabaseUser(useEvent())
    if (!user) {
        console.error('Authentication failed: User not found')
        throw createError({
            statusCode: 403,
            message: 'Forbidden. Authentication required.',
        })
    }
    return user
}
