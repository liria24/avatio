import { users } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})
const body = usersUpdateSchema.pick({
    username: true,
    name: true,
    image: true,
    bio: true,
    links: true,
})

const log = logger('/api/users/[username]:PUT')

export default authedSessionEventHandler(async ({ event, session, db }) => {
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
        const isUsernameAvailable = await getAuth(event).api.isUsernameAvailable({
            body: { username },
        })
        if (!isUsernameAvailable) throw serverError.badRequest()
    }

    const [updated] = await db
        .update(users)
        .set({
            updatedAt: new Date(),
            username,
            name,
            image,
            bio,
            links,
        })
        .where(
            session.user.role === 'admin'
                ? eq(users.id, data.id)
                : and(eq(users.id, data.id), eq(users.id, session.user.id)),
        )
        .returning({ id: users.id })
    if (!updated) throw serverError.notFound()

    log.success(`User ${username} updated successfully`)

    await purgeUserContentCache(event, db, data.id, 'user profile update')

    return null
})
