import { serverSupabaseClient } from '#supabase/server';
import { z } from 'zod';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');

    const idSchema = z
        .string({
            required_error: 'ID is required',
            invalid_type_error: 'ID must be a string',
        })
        .uuid('Invalid UUID format');

    try {
        idSchema.parse(id);
    } catch (error) {
        console.error('Invalid ID:', error);
        throw createError({
            statusCode: 400,
            message:
                error instanceof z.ZodError
                    ? `Invalid request: ${error.errors[0]?.message || 'Invalid ID'}`
                    : 'Invalid request: Invalid ID',
        });
    }

    const supabase = await serverSupabaseClient<Database>(event);

    const { data, error } = await supabase
        .from('users')
        .select(
            `
            id, name, avatar, bio, links, created_at,
            badges:user_badges(created_at, name),
            shops:user_shops(shop:shop_id(id, name, thumbnail, verified))
            `
        )
        .eq('id', id!)
        .maybeSingle<User>();

    if (error) {
        console.error('Database error:', error);
        throw createError({
            statusCode: 500,
            message: `Database error: ${error.message}`,
        });
    }

    if (!data) {
        console.error(`User with ID ${id} not found`);
        throw createError({
            statusCode: 404,
            message: `User with ID ${id} not found`,
        });
    }

    return data;
});
