import { user } from '@@/database/schema'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})
const body = userUpdateSchema

export default defineApi(
    async ({ session }) => {
        const { username: oldUsername } = await validateParams(params)
        const { username, name, image, bio, links, isInitialized } =
            await validateBody(body, { sanitize: true })

        const data = await db.query.user.findFirst({
            where: {
                username: { eq: oldUsername },
                banned: { OR: [{ eq: false }, { isNull: true }] },
            },
            columns: {
                id: true,
                username: true,
            },
        })

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })

        if (data.id !== session.user.id && session.user.role !== 'admin')
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden',
            })

        if (username) {
            const isUsernameAvailable = await auth.api.isUsernameAvailable({
                body: { username },
            })
            if (!isUsernameAvailable)
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Username is not available',
                })
        }

        await db
            .update(user)
            .set({
                updatedAt: new Date(),
                username,
                name,
                image,
                bio,
                links,
                isInitialized,
            })
            .where(eq(user.id, data.id))

        consola.success(`User ${username} updated successfully`)

        await purgeUserCache(data.id)

        return null
    },
    {
        errorMessage: 'Failed to update user.',
        requireSession: true,
    }
)
