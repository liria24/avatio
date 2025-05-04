import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
    const supabase = await serverSupabaseClient<Database>(event);

    const { data, error } = await supabase
        .from('releases')
        .select(
            'slug, created_at, updated_at, title, description, thumbnail, category, content, published'
        )
        .eq('published', true)
        .order('created_at', { ascending: false });

    if (error)
        throw createError({
            statusCode: 500,
            message: error.message,
        });

    return data;
});
