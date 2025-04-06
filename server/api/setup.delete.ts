import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestBodySchema = z.object({
    id: z
        .number({
            required_error: 'idは必須です',
            invalid_type_error: 'idは数値である必要があります',
        })
        .positive('idは正の数である必要があります'),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(async (event) => {
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

    const rawBody = await readBody(event);
    const result = requestBodySchema.safeParse(rawBody);

    if (!result.success) {
        throw createError({
            statusCode: 400,
            message: `不正なリクエスト: ${result.error.format()}`,
        });
    }

    const body = result.data;
    const supabase = await serverSupabaseClient<Database>(event);

    const { data: setupData } = await supabase
        .from('setups')
        .select('images:setup_images(name)')
        .eq('id', body.id)
        .maybeSingle();

    if (!setupData) {
        throw createError({
            statusCode: 404,
            message: 'Setup not found.',
        });
    }

    const { error } = await supabase.from('setups').delete().eq('id', body.id);

    if (error) {
        throw createError({
            statusCode: 500,
            message: 'Failed to delete setup.',
        });
    }

    const failed = [];

    // 画像削除処理
    for (const image of setupData.images) {
        try {
            await event.$fetch(`/api/image`, {
                method: 'DELETE',
                query: { name: image.name, prefix: 'setup' },
            });
        } catch {
            failed.push(image.name);
        }
    }

    if (failed.length) {
        // 画像削除に失敗してもセットアップ自体は削除されているので、警告として200で返す
        setResponseStatus(event, 200);
        return {
            id: body.id,
            warning: `Failed to delete some images: ${failed.join(', ')}`,
        };
    }

    setResponseStatus(event, 204);
    return null;
});
