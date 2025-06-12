import type { z } from 'zod/v4'

export const validateParams = async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedRouterParams(useEvent(), (body) =>
        schema.safeParse(body)
    )

    if (!result.success) throw result.error

    return result.data
}
