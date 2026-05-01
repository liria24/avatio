import { z } from 'zod'

const query = z.object({
    archived: z.stringbool().optional(),
})

export default adminSessionEventHandler(async () => {
    const { archived } = await validateQuery(query)

    await syncEmails()

    return db.query.emails.findMany({
        where: {
            isArchived: { eq: archived ?? false },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })
})
