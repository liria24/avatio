import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';
import { z } from 'zod';

const requestBodySchema = z.object({
    shopId: z
        .string({
            required_error: 'Shop ID is required',
            invalid_type_error: 'Shop ID must be a string',
        })
        .min(1, 'Shop ID cannot be empty'),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(async (event) => {
    try {
        const result = requestBodySchema.safeParse(await readBody(event));

        if (!result.success) {
            const errorMessage = `Invalid request: ${result.error.issues.map((i) => i.message).join(', ')}`;
            console.error(errorMessage);
            throw createError({
                statusCode: 400,
                message: errorMessage,
            });
        }

        const { shopId } = result.data;

        const user = await serverSupabaseUser(event).catch(() => null);
        if (!user?.id) {
            console.error('Authentication required');
            throw createError({
                statusCode: 403,
                message: 'Authentication required',
            });
        }

        const supabase = await serverSupabaseServiceRole<Database>(event);

        const { data, error: deleteError } = await supabase
            .from('user_shops')
            .delete()
            .eq('user_id', user.id)
            .eq('shop_id', shopId)
            .select()
            .maybeSingle();

        if (deleteError) {
            console.error('Error deleting user shop:', deleteError);
            throw createError({
                statusCode: 500,
                message: 'Error occurred while deleting shop association',
            });
        }

        if (!data) {
            console.error('Shop not found or not owned by the user');
            throw createError({
                statusCode: 404,
                message: 'Shop not found or not owned by the user',
            });
        }

        // ユーザーの他のショップをチェック
        const { data: userShops, error: selectError } = await supabase
            .from('user_shops')
            .select('id')
            .eq('user_id', user.id);

        if (selectError) {
            console.error('Error checking user shops:', selectError);
            throw createError({
                statusCode: 500,
                message: 'Failed to retrieve user shop information',
            });
        }

        // 他のショップがなければバッジも削除
        if (!userShops?.length) {
            const { error: badgeError } = await supabase
                .from('user_badges')
                .delete()
                .eq('user_id', user.id)
                .eq('name', 'shop_owner');

            if (badgeError) {
                console.error('Error removing shop owner badge:', badgeError);
            }
        }

        setResponseStatus(event, 204);
        return null;
    } catch (error: any) {
        if (error?.statusCode) throw error;

        console.error('Unexpected error in unverify:', error);
        throw createError({
            statusCode: 500,
            message: 'An unexpected error occurred',
        });
    }
});
