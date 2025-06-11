export default defineEventHandler(async () => {
    const { id } = await checkSupabaseUser()

    const supabase = await getSupabaseServiceRoleClient()

    const { error } = await supabase.auth.admin.deleteUser(id)

    if (error) {
        console.error(error)
        throw createError({
            statusCode: 500,
            message: 'Error on deleting user.',
        })
    }

    setResponseStatus(useEvent(), 204)
    return null
})
