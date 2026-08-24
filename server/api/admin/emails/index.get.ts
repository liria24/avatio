import { z } from 'zod'

const query = z.object({
    archived: z.stringbool().optional(),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { archived } = await validateQuery(query)

    return db.query.emails.findMany({
        where: {
            isArchived: { eq: archived ?? false },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })
})
