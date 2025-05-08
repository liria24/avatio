import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

export default defineEventHandler(async (event) => {
    try {
        // ユーザー認証チェック
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('Authentication failed: User not found');
            throw createError({
                statusCode: 403,
                message: 'Forbidden. Authentication required.',
            });
        }

        // IDパラメータの取得とバリデーション
        const id = getRouterParam(event, 'id');
        const idSchema = z
            .string({
                required_error: 'ID is required',
                invalid_type_error: 'ID must be a string',
            })
            .refine(
                (val) =>
                    !isNaN(Number(val)) &&
                    Number(val) > 0 &&
                    Number.isInteger(Number(val)),
                { message: 'ID must be a positive integer' }
            );

        try {
            idSchema.parse(id);
        } catch (error) {
            console.error('Invalid ID:', error);
            throw createError({
                statusCode: 400,
                message:
                    error instanceof z.ZodError
                        ? `Bad request: ${error.errors[0]?.message || 'Invalid ID'}`
                        : 'Bad request: Invalid ID format',
            });
        }

        const numericId = Number(id);
        const supabase = await serverSupabaseClient<Database>(event);

        // セットアップデータの取得
        const { data: setupData, error: fetchError } = await supabase
            .from('setups')
            .select('images:setup_images(name)')
            .eq('id', numericId)
            .maybeSingle();

        if (fetchError) {
            console.error('Failed to fetch setup data:', fetchError);
            throw createError({
                statusCode: 500,
                message: 'Failed to fetch setup data.',
            });
        }

        if (!setupData) {
            console.error(`Setup not found with ID: ${numericId}`);
            throw createError({
                statusCode: 404,
                message: 'Setup not found.',
            });
        }

        // セットアップの削除
        const { error: deleteError } = await supabase
            .from('setups')
            .delete()
            .eq('id', numericId);

        if (deleteError) {
            console.error('Failed to delete setup:', deleteError);
            throw createError({
                statusCode: 500,
                message: 'Failed to delete setup.',
            });
        }

        // 関連画像の削除
        const failed = [];
        for (const image of setupData.images) {
            try {
                await event.$fetch(`/api/image`, {
                    method: 'DELETE',
                    query: { name: image.name, prefix: 'setup' },
                });
            } catch (error) {
                console.error(`Failed to delete image ${image.name}:`, error);
                failed.push(image.name);
            }
        }

        if (failed.length) {
            // 画像削除に失敗してもセットアップ自体は削除されているので、警告として200で返す
            setResponseStatus(event, 200);
            return {
                id: numericId,
                warning: `Successfully deleted setup, but failed to delete some images: ${failed.join(', ')}`,
            };
        }

        setResponseStatus(event, 204);
        return null;
    } catch (error) {
        console.error('Error in setup deletion:', error);
        throw createError({
            statusCode: 500,
            message: 'An unexpected error occurred.',
        });
    }
});
