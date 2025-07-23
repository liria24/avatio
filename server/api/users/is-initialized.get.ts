import database from '@@/database'

export default defineApi<{
    result: boolean
}>(
    async ({ session }) => {
        const data = await database.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, session!.user.id),
            columns: {
                id: true,
                isInitialized: true,
            },
        })

        if (!data)
            throw createError({
                statusCode: 404,
                message: 'User not found',
            })

        return { result: data.isInitialized }
    },
    {
        errorMessage: 'Failed to check user initialization status.',
        requireSession: true,
    }
)
