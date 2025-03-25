import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
    const deleteCompleted = [];
    const deleteFailed = [];

    const storage = imageStorageClient();

    const supabase = await serverSupabaseClient<Database>(event);

    const { data } = await supabase.from('users').select('avatar');

    if (!data) return null;
    const userImages = data
        .map((i) => i.avatar)
        .filter((i) => i?.length && i !== null && i !== undefined);

    const storageUserImages = (await storage.keys('avatar'))
        .map((image) => image.split(':').at(-1))
        .filter((image) => image !== undefined && image !== null);

    const unusedImages = storageUserImages.filter(
        (image) => !userImages.includes(image)
    );

    for (const image of unusedImages) {
        const { data } = await supabase
            .from('users')
            .select('avatar')
            .eq('avatar', image)
            .maybeSingle();

        if (!data) {
            await storage.del(`avatar:${image}`);

            if (await storage.has(`avatar:${image}`)) {
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
