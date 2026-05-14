import type { H3Event } from 'h3'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
    if (session?.user?.banned) throw serverError.forbidden()
}

export const promiseEventHandler = <T = unknown>(
    handler: ({ event }: { event: H3Event }) => Promise<T> | T,
) => eventHandler(async (event) => handler({ event }))

export const sessionEventHandler = <T = unknown>(
    handler: ({ event, session }: { event: H3Event; session: Session | null }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    promiseEventHandler(async ({ event }) => {
        const session = await auth.api.getSession({ headers: event.headers })

        if (options?.rejectBannedUser) rejectBannedUser(session)

        return await handler({ event, session })
    })

export const authedSessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
    }: {
        event: H3Event
        session: NonNullable<Session>
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    sessionEventHandler(async ({ event, session }) => {
        if (!session) throw serverError.unauthorized()

        return await handler({ event, session })
    }, options)

export const adminSessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
    }: {
        event: H3Event
        session: NonNullable<Session>
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    sessionEventHandler(async ({ event, session }) => {
        if (!session || session.user.role !== 'admin') throw serverError.forbidden()

        return await handler({ event, session })
    }, options)

export const cronEventHandler = <T = unknown>(
    handler: ({ event }: { event: H3Event }) => Promise<T> | T,
) =>
    promiseEventHandler(async ({ event }) => {
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

        return await handler({ event })
    })
