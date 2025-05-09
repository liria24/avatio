import { serverSupabaseClient } from '#supabase/server';
import { z } from 'zod';
import { DocumentData } from '~~/shared/types';

export default defineEventHandler(async (event): Promise<DocumentData> => {
    const slug = getRouterParam(event, 'slug');

    const slugSchema = z
        .string({
            required_error: 'Slug is required',
            invalid_type_error: 'Slug must be a string',
        })
        .refine(
            (val) =>
                !isNaN(Number(val)) &&
                Number(val) > 0 &&
                Number.isInteger(Number(val)),
            { message: 'Slug must be a positive integer' }
        );

    try {
        slugSchema.parse(slug);
    } catch (error) {
        console.error('Invalid Slug:', error);
        throw createError({
            statusCode: 400,
            message:
                error instanceof z.ZodError
                    ? `Invalid request: ${error.errors[0]?.message || 'Invalid Slug'}`
                    : 'Invalid request: Invalid Slug',
        });
    }

    const supabase = await serverSupabaseClient<Database>(event);

    const { data, error } = await supabase
        .from('info')
        .select(
            'slug, created_at, updated_at, title, content, thumbnail, published'
        )
        .eq('published', true)
        .eq('slug', slug!)
        .maybeSingle<DocumentData>();

    if (error) {
        console.error('Failed to fetch info data:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch info data.',
        });
    }

    if (!data) {
        console.error('No info data found for slug:', slug);
        throw createError({
            statusCode: 404,
            message: 'Info not found.',
        });
    }

    return data;
});
