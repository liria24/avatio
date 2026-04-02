import { z } from 'zod'

export default adminSessionEventHandler(async () => {
    const { archived } = await validateQuery(z.object({ archived: z.coerce.boolean().optional() }))

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
