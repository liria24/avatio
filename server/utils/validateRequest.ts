import type { z } from 'zod'

import { destr } from 'destr'

export const validateBody = async <T extends z.ZodTypeAny>(
    schema: T,
    options?: { sanitize?: boolean }
): Promise<z.infer<T>> => {
    const result = await readValidatedBody(useEvent(), (body) => {
        if (options?.sanitize) body = sanitizeObject(body)

        return schema.safeParse(body)
    })

    if (!result.success) {
        if (import.meta.dev) logger('validateBody').error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateFormData = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const formData = await readFormData(useEvent())

    const dataToValidate: Record<string, unknown> = {}
    for (const [key, value] of formData.entries()) {
        dataToValidate[key] = destr(value)
    }

    const result = schema.safeParse(dataToValidate)

    if (!result.success) {
        if (import.meta.dev) logger('validateFormData').error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateParams = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const result = await getValidatedRouterParams(useEvent(), (body) => schema.safeParse(body))

    if (!result.success) {
        if (import.meta.dev) logger('validateParams').error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateQuery = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(useEvent(), (query) => schema.safeParse(query))

    if (!result.success) {
        if (import.meta.dev) logger('validateQuery').error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}
