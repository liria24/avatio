import { destr } from 'destr'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import type { z } from 'zod'

const throwIfFailed = <T>(
    tag: string,
    result: z.ZodSafeParseSuccess<T> | z.ZodSafeParseError<unknown>,
): T => {
    if (!result.success) {
        if (import.meta.dev) logger(tag).error(result.error)
        throw createError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: 'Validation Error',
        })
    }
    return result.data
}

export const validateBody = async <T extends z.ZodTypeAny>(
    s: T,
    o?: { sanitize?: boolean },
): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateBody',
        await readValidatedBody(useEvent(), (b) =>
            s.safeParse(o?.sanitize ? sanitizeObject(b) : b),
        ),
    )

export const validateFormData = async <T extends z.ZodTypeAny>(s: T): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateFormData',
        s.safeParse(
            Object.fromEntries(
                [...(await readFormData(useEvent())).entries()].map(([k, v]) => [k, destr(v)]),
            ),
        ),
    )

export const validateParams = async <T extends z.ZodTypeAny>(s: T): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateParams',
        await getValidatedRouterParams(useEvent(), (p) => s.safeParse(p)),
    )

export const validateQuery = async <T extends z.ZodTypeAny>(s: T): Promise<z.infer<T>> =>
    throwIfFailed('validateQuery', await getValidatedQuery(useEvent(), (q) => s.safeParse(q)))
