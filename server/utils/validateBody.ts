import type { z } from 'zod'

export default async <T extends z.ZodTypeAny>(
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
