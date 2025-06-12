import type { z } from 'zod/v4'

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
