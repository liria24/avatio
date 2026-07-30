import type { H3Event } from 'h3'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
    if (session?.user?.banned) throw serverError.forbidden()
}

const hasBetterAuthSessionCookie = (headers: Headers) => {
    const cookie = headers.get('cookie')
    return Boolean(cookie?.includes('better-auth'))
}

export const promiseEventHandler = <T = unknown>(
    handler: ({ event, db }: { event: H3Event; db: ReturnType<typeof useDB> }) => Promise<T> | T,
) => {
    return eventHandler(async (event) => {
        const db = useDB()
        return handler({ event, db })
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
        const session = hasBetterAuthSessionCookie(event.headers)
            ? await auth.api.getSession({ headers: event.headers })
            : null

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
        assertAdminSession(session)

        return await handler({ event, session, db })
    }, options)
