import { getReasonPhrase, StatusCodes } from 'http-status-codes'

interface ServerErrorOptions {
    log?: {
        tag?: string
        message: string
    }
    responseMessage?: string
}

export const serverError = {
    /** 400 */
    badRequest(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: options?.responseMessage,
        })
    },
    /** 401 */
    unauthorized(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.UNAUTHORIZED,
            statusText: getReasonPhrase(StatusCodes.UNAUTHORIZED),
            message: options?.responseMessage,
        })
    },
    /** 403 */
    forbidden(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.FORBIDDEN,
            statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
            message: options?.responseMessage,
        })
    },
    /** 404 */
    notFound(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
            message: options?.responseMessage,
        })
    },
    /** 429 */
    tooManyRequests(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.TOO_MANY_REQUESTS,
            statusText: getReasonPhrase(StatusCodes.TOO_MANY_REQUESTS),
            message: options?.responseMessage,
        })
    },
    /** 500 */
    internalServerError(options?: ServerErrorOptions): never {
        if (options?.log) logger(options.log.tag ?? 'server:error').error(options.log.message)
        throw createError({
            status: StatusCodes.INTERNAL_SERVER_ERROR,
            statusText: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
            message: options?.responseMessage,
        })
    },
}

export const isDatabaseUniqueConflict = (error: unknown) => {
    let current: unknown = error
    for (let depth = 0; depth < 4 && current; depth += 1) {
        const message =
            current instanceof Error ? current.message : typeof current === 'string' ? current : ''
        if (
            message.includes('UNIQUE constraint failed') ||
            message.includes('SQLITE_CONSTRAINT_UNIQUE') ||
            message.includes('duplicate key value violates unique constraint')
        )
            return true
        current = current instanceof Error ? current.cause : undefined
    }
    return false
}
