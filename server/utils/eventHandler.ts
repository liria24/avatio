import type { H3Event } from 'h3'

import { getReasonPhrase, StatusCodes } from 'http-status-codes'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
    if (session?.user?.banned)
        throw createError({
            status: StatusCodes.FORBIDDEN,
            statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
        })
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
        if (!session)
            throw createError({
                status: StatusCodes.UNAUTHORIZED,
                statusText: getReasonPhrase(StatusCodes.UNAUTHORIZED),
            })

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
        const config = useRuntimeConfig()
        const { authorization } = getHeaders(event)
        const isAdminKey = authorization === `Bearer ${config.adminKey}`
        const isAdmin = session?.user?.role === 'admin' || isAdminKey

        if (!session || !isAdmin)
            throw createError({
                status: StatusCodes.FORBIDDEN,
                statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
            })

        return await handler({ event, session })
    }, options)

export const cronEventHandler = <T = unknown>(
    handler: ({ event }: { event: H3Event }) => Promise<T> | T,
) =>
    sessionEventHandler(async ({ event, session }) => {
        const config = useRuntimeConfig()
        const { authorization } = getHeaders(event)
        const isAdminKey = authorization === `Bearer ${config.adminKey}`
        const isAdmin = session?.user?.role === 'admin' || isAdminKey
        const isCronValid = authorization === `Bearer ${process.env.CRON_SECRET}`

        if (!isAdmin && !isCronValid)
            throw createError({
                status: StatusCodes.FORBIDDEN,
                statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
            })

        return await handler({ event })
    })
