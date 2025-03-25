import { serverSupabaseUser } from '#supabase/server';

export default defineEventHandler(
    async (event): Promise<ApiResponse<{ path: string }>> => {
        const storage = imageStorageClient();

        try {
            const user = await serverSupabaseUser(event);
            if (!user) throw new Error();
        } catch {
            return {
                error: { status: 403, message: 'Forbidden.' },
                data: null,
            };
        }

        const query: { name: string; prefix: string } = getQuery(event);

        if (!query.name)
            return {
                error: { status: 400, message: 'No path provided.' },
                data: null,
            };

        const target = query.prefix
            ? `${query.prefix}/${query.name}`
            : query.name;

        console.log('Deleting image on R2.', target);
        await storage.del(target);

        if (await storage.has(target)) {
            console.error('Failed to delete image on R2.', target);
            return {
                error: { status: 400, message: 'Delete on R2 failed.' },
                data: null,
            };
        }

        return {
            error: null,
            data: { path: target },
        };
    }
);
