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
