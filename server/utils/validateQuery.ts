import type { z } from 'zod/v4'

export const validateQuery = async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(useEvent(), (query) =>
        schema.safeParse(query)
    )

    if (!result.success) throw result.error

    return result.data
}
