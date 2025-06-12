import { z } from 'zod/v4'

const params = z.object({
    slug: z
        .string('Slug is required')
        .refine(
            (val) =>
                !isNaN(Number(val)) &&
                Number(val) > 0 &&
                Number.isInteger(Number(val)),
            { message: 'Slug must be a positive integer' }
        ),
})

export default defineEventHandler(async (): Promise<DocumentData> => {
    const { slug } = await validateParams(params)

    const supabase = await getSupabaseServerClient()

    const { data, error } = await supabase
        .from('info')
        .select(
            'slug, created_at, updated_at, title, content, thumbnail, published'
        )
        .eq('published', true)
        .eq('slug', slug!)
        .maybeSingle<DocumentData>()

    if (error) {
        console.error('Failed to fetch info data:', error)
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch info data.',
        })
    }

    if (!data) {
        console.error('No info data found for slug:', slug)
        throw createError({
            statusCode: 404,
            message: 'Info not found.',
        })
    }

    return data
})
