import type { ViewerIdentity } from '@avatio/core'
import { createError, eventHandler, type H3Event } from '@nuxt/nitro-server/h3'

import type { ServerRequestScope } from './composition'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

type Session = NonNullable<Awaited<ReturnType<typeof getRequestSession>>>

export const assertSessionNotBanned = (session: Session | null) => {
    if (session?.user?.banned) throw serverError.forbidden()
}

const toViewerIdentity = (session: Session | null): ViewerIdentity | null =>
    session
        ? {
              id: session.user.id,
              role: session.user.role ?? null,
              banned: Boolean(session.user.banned),
          }
        : null

const runWithConflictMapping = async <T>(work: () => Promise<T> | T): Promise<T> => {
    try {
        return await work()
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
}

export const promiseEventHandler = <T = unknown>(
    handler: ({
        event,
        db,
        services,
    }: {
        event: H3Event
        db: AppDatabase
        services: ServerRequestScope
    }) => Promise<T> | T,
) => {
    return eventHandler(async (event) => {
        const services = createRequestScope(event, null)
        const db = services.db
        return runWithConflictMapping(() => handler({ event, db, services }))
    })
}

export const sessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
        db,
        services,
    }: {
        event: H3Event
        session: Session | null
        db: AppDatabase
        services: ServerRequestScope
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    eventHandler(async (event) =>
        runWithConflictMapping(async () => {
            const session = await getRequestSession(event)
            if (options?.rejectBannedUser) assertSessionNotBanned(session)

            const services = createRequestScope(event, toViewerIdentity(session))
            const db = services.db
            return handler({ event, session, db, services })
        }),
    )

export const authedSessionEventHandler = <T = unknown>(
    handler: ({
        event,
        session,
        db,
        services,
    }: {
        event: H3Event
        session: NonNullable<Session>
        db: AppDatabase
        services: ServerRequestScope
    }) => Promise<T> | T,
    options?: SessionEventHandlerOptions,
) =>
    eventHandler(async (event) =>
        runWithConflictMapping(async () => {
            const session = await requireUserSession(event)
            if (options?.rejectBannedUser) assertSessionNotBanned(session)

            const services = createRequestScope(event, toViewerIdentity(session))
            const db = services.db
            return handler({ event, session, db, services })
        }),
    )
