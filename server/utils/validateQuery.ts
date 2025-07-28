import type { z } from 'zod'

export default async <T extends z.ZodTypeAny>(
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(useEvent(), (query) =>
        schema.safeParse(query)
    )

    if (!result.success) throw result.error

    return result.data
}
