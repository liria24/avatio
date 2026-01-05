import { getReasonPhrase, StatusCodes } from 'http-status-codes'

interface SessionEventHandlerOptions {
    rejectBannedUser?: boolean
}

const rejectBannedUser = (session: Session | null) => {
    if (session?.user?.banned)
        throw createError({
            statusCode: StatusCodes.FORBIDDEN,
            statusMessage: getReasonPhrase(StatusCodes.FORBIDDEN),
        })
}

export const sessionEventHandler = <T = unknown>(
    handler: ({ session }: { session: Session | null }) => Promise<T> | T,
    options?: SessionEventHandlerOptions
) =>
    eventHandler(async (event) => {
        const session = await auth.api.getSession({ headers: event.headers })

        if (options?.rejectBannedUser) rejectBannedUser(session)

        return handler({ session })
    })

export const authedSessionEventHandler = <T = unknown>(
    handler: ({ session }: { session: NonNullable<Session> }) => Promise<T> | T,
    options?: SessionEventHandlerOptions
) =>
    sessionEventHandler(async ({ session }) => {
        if (!session)
            throw createError({
                statusCode: StatusCodes.UNAUTHORIZED,
                statusMessage: getReasonPhrase(StatusCodes.UNAUTHORIZED),
            })

        if (options?.rejectBannedUser) rejectBannedUser(session)

        return handler({ session })
    })

export const adminSessionEventHandler = <T = unknown>(
    handler: ({ session }: { session: NonNullable<Session> }) => Promise<T> | T,
    options?: SessionEventHandlerOptions
) =>
    sessionEventHandler(async ({ session }) => {
        if (session?.user?.role !== 'admin')
            throw createError({
                statusCode: StatusCodes.FORBIDDEN,
                statusMessage: getReasonPhrase(StatusCodes.FORBIDDEN),
            })

        if (options?.rejectBannedUser) rejectBannedUser(session)

        return handler({ session })
    })
