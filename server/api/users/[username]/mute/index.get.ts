import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler(async ({ session }) => {
    const { username } = await validateParams(params)

    if (!session)
        return {
            isMuted: false,
        }

    const data = await db.query.userMutes.findFirst({
        where: {
            mutee: { username: { eq: username } },
            userId: { eq: session.user.id },
        },
        columns: {
            createdAt: true,
        },
    })

    return {
        isMuted: !!data,
    }
})
