import { user } from '@@/database/schema'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})
const body = userUpdateSchema

export default defineApi(
    async ({ session }) => {
        const { id } = await validateParams(params)
        const {
            id: newId,
            name,
            image,
            bio,
            links,
            isInitialized,
        } = await validateBody(body, { sanitize: true })

        const data = await db.query.user.findFirst({
            where: {
                id: { eq: id },
                banned: { OR: [{ eq: false }, { isNull: true }] },
            },
            columns: {
                id: true,
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

        if (newId && data.id !== newId) {
            const existingUser = await db.query.user.findFirst({
                where: {
                    id: { eq: newId },
                    banned: { OR: [{ eq: false }, { isNull: true }] },
                },
            })

            if (existingUser)
                throw createError({
                    statusCode: 409,
                    statusMessage: 'User with this ID already exists',
                })
        }

        await db
            .update(user)
            .set({
                id: newId,
                updatedAt: new Date(),
                name,
                image,
                bio,
                links,
                isInitialized,
            })
            .where(eq(user.id, id))

        consola.success(`User ${id} updated successfully`)

        await purgeUserCache(id)

        return null
    },
    {
        errorMessage: 'Failed to update user.',
        requireSession: true,
    }
)
