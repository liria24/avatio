import { serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestQuerySchema = z.object({
    name: z
        .string({
            required_error: 'File name is required',
            invalid_type_error: 'File name must be a string',
        })
        .min(1, 'File name is required'),

    prefix: z
        .string({
            invalid_type_error: 'Prefix must be a string',
        })
        .optional(),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

export default defineEventHandler(async (event): Promise<{ path: string }> => {
    const storage = imageStorageClient();

    // ユーザー認証のエラーハンドリングを簡略化
    try {
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('Authentication failed: User not found');
            throw createError({
                statusCode: 403,
                message: 'Forbidden: User authentication required',
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        throw createError({
            statusCode: 403,
            message: 'Forbidden: Authentication failed',
        });
    }

    // クエリパラメータのバリデーション
    const rawQuery = getQuery(event);
    const result = requestQuerySchema.safeParse(rawQuery);

    if (!result.success) {
        const errorMessage = result.error.issues
            .map((i) => i.message)
            .join(', ');
        console.error(`Invalid request: ${errorMessage}`);
        throw createError({
            statusCode: 400,
            message: `Bad request: ${errorMessage}`,
        });
    }

    const query = result.data;
    const target = query.prefix ? `${query.prefix}:${query.name}` : query.name;

    console.log('Deleting image on storage:', target);

    try {
        await storage.del(target);

        // 削除後の検証
        if (await storage.has(target)) {
            console.error('Failed to delete image on storage:', target);
            throw createError({
                statusCode: 500,
                message: 'Delete operation on storage failed',
            });
        }

        return { path: target };
    } catch (error) {
        console.error('Error during image deletion:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to delete image: internal server error',
        });
    }
});
