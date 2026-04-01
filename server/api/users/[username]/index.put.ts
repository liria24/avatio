import { users } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})
const body = usersUpdateSchema

const log = logger('/api/users/[username]:PUT')

export default authedSessionEventHandler(async ({ session }) => {
    const { username: oldUsername } = await validateParams(params)
    const { username, name, image, bio, links } = await validateBody(body, {
        sanitize: true,
    })

    const data = await db.query.users.findFirst({
        where: {
            username: { eq: oldUsername },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
            username: true,
        },
    })

    if (!data) throw serverError.notFound()
    if (data.id !== session.user.id && session.user.role !== 'admin') throw serverError.forbidden()

    if (username) {
        const isUsernameAvailable = await auth.api.isUsernameAvailable({
            body: { username },
        })
        if (!isUsernameAvailable) throw serverError.badRequest()
    }

    await db
        .update(users)
        .set({
            updatedAt: new Date(),
            username,
            name,
            image,
            bio,
            links,
        })
        .where(eq(users.id, data.id))

    log.success(`User ${username} updated successfully`)

    await purgeUserCache(data.id)

    return null
})
