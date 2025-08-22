import database from '@@/database'
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

        const data = await database.query.user.findFirst({
            where: (users, { eq }) => eq(users.id, id),
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

        // Critical fix: Check if new ID is different and available before updating
        if (newId && newId !== id) {
            const existingUser = await database.query.user.findFirst({
                where: (users, { eq }) => eq(users.id, newId),
                columns: {
                    id: true,
                },
            })

            if (existingUser)
                throw createError({
                    statusCode: 409,
                    statusMessage: 'User ID already exists',
                })

            // Log the ID change for security audit
            await createAuditLog({
                userId: session.user.id,
                action: 'update',
                targetType: 'user',
                targetId: id,
                details: `User ID changed from "${id}" to "${newId}"`,
            })
        }

        await database
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

        return null
    },
    {
        errorMessage: 'Failed to update user.',
        requireSession: true,
    }
)
