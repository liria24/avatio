import type { H3Event } from 'h3'

import { hasBetterAuthSessionCookie } from '../../shared/utils/authCookie'
import { getAuth } from './auth'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
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
        const session = hasBetterAuthSessionCookie(event.headers.get('cookie'))
            ? await getAuth(event).api.getSession({ headers: event.headers })
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
        if (!session || session.user.role !== 'admin') throw serverError.forbidden()

        return await handler({ event, session, db })
    }, options)
