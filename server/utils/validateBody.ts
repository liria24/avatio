import type { z } from 'zod/v4'

export const validateBody = async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await readValidatedBody(useEvent(), (body) =>
        schema.safeParse(body)
    )

    if (!result.success) throw result.error

    return result.data
}
