import type { H3Event } from 'h3'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
    if (session?.user?.banned) throw serverError.forbidden()
}

export const promiseEventHandler = <T = unknown>(
    handler: ({ event, db }: { event: H3Event; db: ReturnType<typeof useDB> }) => Promise<T> | T,
) => {
    const db = useDB()
    return eventHandler(async (event) => handler({ event, db }))
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
        const session = await auth.api.getSession({ headers: event.headers })

        if (options?.rejectBannedUser) rejectBannedUser(session)

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
    sessionEventHandler(async ({ event, session, db }) => {
        if (!session) throw serverError.unauthorized()

        return await handler({ event, session, db })
    }, options)

export const adminSessionEventHandler = <T = unknown>(
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
    sessionEventHandler(async ({ event, session, db }) => {
        if (!session || session.user.role !== 'admin') throw serverError.forbidden()

        return await handler({ event, session, db })
    }, options)

export const cronEventHandler = <T = unknown>(
    handler: ({ event, db }: { event: H3Event; db: ReturnType<typeof useDB> }) => Promise<T> | T,
) =>
    promiseEventHandler(async ({ event, db }) => {
        const cronSecret = process.env.CRON_SECRET?.trim()

        if (!cronSecret)
            throw serverError.forbidden({
                log: {
                    tag: 'cronEventHandler',
                    message: 'CRON_SECRET is not configured',
                },
            })

        const { authorization } = getHeaders(event)
        const isCronValid = authorization === `Bearer ${cronSecret}`

        if (!isCronValid) throw serverError.forbidden()

        return await handler({ event, db })
    })
