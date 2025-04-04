import { serverSupabaseClient } from '#supabase/server';

export interface RequestBody {
    adminKey: string;
}

export default defineEventHandler(async (event) => {
    const { adminKey } = await readBody<RequestBody>(event);

    const config = useRuntimeConfig();
    if (adminKey !== config.adminKey)
        return {
            error: { status: 403, message: 'Forbidden.' },
            data: null,
        };

    const deleteCompleted = [];
    const deleteFailed = [];

    const storage = imageStorageClient();

    const supabase = await serverSupabaseClient<Database>(event);

    const { data, error } = await supabase.from('setup_images').select('name');

    if (error) {
        console.error('Error fetching image from Supabase:', error);
        return;
    }

    if (!data) return null;
    const setupImages = data.map((i) => i.name);

    const storageImages = (await storage.keys('setup'))
        .map((image) => image.split(':').at(-1))
        .filter((image) => image !== undefined && image !== null);

    const unusedImages = storageImages.filter(
        (image) => !setupImages.includes(image)
    );

    for (const image of unusedImages) {
        const { data, error } = await supabase
            .from('setup_images')
            .select('name')
            .eq('name', image)
            .maybeSingle();

        if (error) {
            console.error('Error fetching image from Supabase:', error);
            break;
        }

        if (!data) {
            await storage.del(`setup:${image}`);

            if (await storage.has(`setup:${image}`)) {
                console.error('Failed to delete image on R2.', image);
                deleteFailed.push(image);
            } else {
                deleteCompleted.push(image);
            }
        }
    }

    return {
        completed: deleteCompleted,
        failed: deleteFailed,
    };
});
