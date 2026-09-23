import type { H3Event } from '@nuxt/nitro-server/h3'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

type Session = NonNullable<Awaited<ReturnType<typeof getRequestSession>>>

export const assertSessionNotBanned = (session: Session | null) => {
    if (session?.user?.banned) throw serverError.forbidden()
}

export const promiseEventHandler = <T = unknown>(
    handler: ({ event, db }: { event: H3Event; db: ReturnType<typeof useDB> }) => Promise<T> | T,
) => {
    return eventHandler(async (event) => {
        const db = useDB()
        try {
            return await handler({ event, db })
        } catch (error) {
            if (isDatabaseUniqueConflict(error))
                throw createError({
                    statusCode: 409,
                    statusMessage: 'Conflict',
                    message: 'The requested database state conflicts with an existing resource.',
                    cause: error,
                })
            throw error
        }
    })
}

export const sessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
        db,
    }: {
        event: H3Event
        session: Session | null
        db: ReturnType<typeof useDB>
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    promiseEventHandler(async ({ event, db }) => {
        const session = await getRequestSession(event)

        if (options?.rejectBannedUser) assertSessionNotBanned(session)

        return await handler({ event, session, db })
    })

export const authedSessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
        db,
    }: {
        event: H3Event
        session: NonNullable<Session>
        db: ReturnType<typeof useDB>
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    promiseEventHandler(async ({ event, db }) => {
        const session = await requireUserSession(event)
        if (options?.rejectBannedUser) assertSessionNotBanned(session)

        return await handler({ event, session, db })
    })
