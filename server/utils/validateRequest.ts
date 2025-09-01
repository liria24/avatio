import type { z } from 'zod'

export const validateBody = async <T extends z.ZodTypeAny>(
    schema: T,
    options?: { sanitize?: boolean }
): Promise<z.infer<T>> => {
    const result = await readValidatedBody(useEvent(), (body) => {
        if (options?.sanitize) body = sanitizeObject(body)

        return schema.safeParse(body)
    })

    if (!result.success) {
        console.error('Validation failed:', result.error)
        throw result.error
    }

    return result.data
}

export const validateFormData = async <T extends z.ZodTypeAny>(
    schema: T,
    transformer?: (formData: FormData) => Record<string, unknown>
): Promise<z.infer<T>> => {
    const formData = await readFormData(useEvent())

    // デフォルトはFormDataをオブジェクトに変換
    const dataToValidate = transformer
        ? transformer(formData)
        : Object.fromEntries(formData.entries())

    const result = schema.safeParse(dataToValidate)

    if (!result.success) throw result.error

    return result.data
}

export const validateParams = async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedRouterParams(useEvent(), (body) =>
        schema.safeParse(body)
    )

    if (!result.success) throw result.error

    return result.data
}

export const validateQuery = async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(useEvent(), (query) =>
        schema.safeParse(query)
    )

    if (!result.success) throw result.error

    return result.data
}
