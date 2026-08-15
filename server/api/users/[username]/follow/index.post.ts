import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { userFollows } from '~~/database/schema'

const params = z.object({
    username: z.string(),
})

export default authedSessionEventHandler(async ({ event, session, db }) => {
    const { username } = await validateParams(params)

    const followerId = session.user.id
    await enforceRateLimit({
        binding: 'RATE_LIMIT_USER_ACTION',
        key: `relations:${followerId}`,
    })
    const followeeData = await db.query.users.findFirst({
        where: {
            username: { eq: username },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
        },
    })

    if (!followeeData)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    if (followerId === followeeData.id)
        throw createError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
        })

    const [created] = await db
        .insert(userFollows)
        .values({
            userId: followerId,
            followeeId: followeeData.id,
        })
        .onConflictDoNothing({ target: [userFollows.userId, userFollows.followeeId] })
        .returning({ id: userFollows.id })

    runAfterResponse(
        (async () => {
            await Promise.all([
                purgeUserContentCache(event, db, followerId, 'follow user'),
                purgeUserContentCache(event, db, followeeData.id, 'followed user'),
                created
                    ? createNotification(event, db, {
                          userId: followeeData.id,
                          type: 'user_followed',
                          actorId: followerId,
                          dedupeKey: `follow:${created.id}`,
                          payload: {
                              user: {
                                  username: session.user.username,
                                  name: session.user.name,
                              },
                          },
                      })
                    : Promise.resolve(),
            ])
        })(),
    )

    return { success: true }
})
