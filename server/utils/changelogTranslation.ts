import { z } from 'zod'

export const changelogTranslationSchema = z.object({
    title: z.string().min(1),
    markdown: z.string().min(1),
})

export const parseChangelogTranslation = (value: string) => {
    const parsed = JSON.parse(value.trim()) as unknown
    return changelogTranslationSchema.parse(sanitizeObject(parsed))
}
