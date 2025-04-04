export const useDeleteSetup = async (id: number) => {
    try {
        await $fetch('/api/setup', {
            method: 'DELETE',
            body: { id: id },
        });
    } catch {
        return useToast().add('セットアップの削除に失敗しました');
    }

    useToast().add('セットアップを削除しました');
    navigateTo('/');
};

export const useAddBookmark = async (id: number) => {
    const client = useSupabaseClient();
    const { data, error } = await client.from('bookmarks').insert({ post: id });
    if (error) throw error;

    useToast().add('ブックマークに追加しました。');
    return data;
};

export const useRemoveBookmark = async (id: number) => {
    const client = useSupabaseClient();
    const { data, error } = await client
        .from('bookmarks')
        .delete()
        .eq('post', id);
    if (error) throw error;

    useToast().add('ブックマークから削除しました。');
    return data;
};

export const useCheckBookmark = async (id: number) => {
    const client = useSupabaseClient();
    const user = useSupabaseUser();

    if (!user.value) return false;

    const { data, error } = await client
        .from('bookmarks')
        .select('post')
        .eq('user_id', user.value.id)
        .eq('post', id);
    if (error) throw error;

    return Boolean(data.length);
};
