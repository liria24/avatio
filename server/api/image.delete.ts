import { serverSupabaseUser } from '#supabase/server';

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

    const query: { name: string; prefix: string } = getQuery(event);

    if (!query.name) {
        throw createError({
            statusCode: 400,
            message: 'No path provided.',
        });
    }

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
