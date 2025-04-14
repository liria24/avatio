import { serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestQuerySchema = z.object({
    name: z
        .string({
            required_error: 'ファイル名は必須です',
            invalid_type_error: 'ファイル名は文字列である必要があります',
        })
        .min(1, 'ファイル名は必須です'),

    prefix: z
        .string({
            invalid_type_error: 'プレフィックスは文字列である必要があります',
        })
        .optional(),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

export default defineEventHandler(async (event): Promise<{ path: string }> => {
    const storage = imageStorageClient();

    try {
        const user = await serverSupabaseUser(event);
        if (!user) {
            throw createError({
                statusCode: 403,
                message: 'Forbidden.',
            });
        }
    } catch {
        throw createError({
            statusCode: 403,
            message: 'Forbidden.',
        });
    }

    const rawQuery = getQuery(event);
    const result = requestQuerySchema.safeParse(rawQuery);

    if (!result.success) {
        throw createError({
            statusCode: 400,
            message: `不正なリクエスト: ${result.error.issues.map((i) => i.message).join(', ')}`,
        });
    }

    const query = result.data;
    const target = query.prefix ? `${query.prefix}:${query.name}` : query.name;

    console.log('Deleting image on R2.', target);
    await storage.del(target);

    if (await storage.has(target)) {
        console.error('Failed to delete image on R2.', target);
        throw createError({
            statusCode: 500,
            message: 'Delete on R2 failed.',
        });
    }

    // 削除成功時は200 OKと削除した情報を返す
    setResponseStatus(event, 200);
    return {
        path: target,
    };
});
