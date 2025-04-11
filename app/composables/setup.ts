import { z } from 'zod';

const limits = setupLimits();

export const setupSchema = z.object({
    name: z
        .string()
        .min(1, 'タイトルを入力してください。')
        .max(limits.title, `タイトルは最大${limits.title}字までです。`),
    description: z
        .string()
        .max(limits.description, `説明は最大${limits.description}字までです。`),
    tags: z
        .array(z.string())
        .max(limits.tags, `タグの数は最大${limits.tags}個までです。`),
    coAuthors: z
        .array(
            z.object({
                id: z.string(),
                note: z
                    .string()
                    .max(
                        limits.coAuthorsNote,
                        `共同作者のメモは最大${limits.coAuthorsNote}字までです。`
                    ),
            })
        )
        .max(
            limits.coAuthors,
            `共同作者の数は最大${limits.coAuthors}人までです。`
        ),
    unity: z
        .string()
        .max(limits.unity, `Unityのバージョンは最大${limits.unity}字までです。`)
        .nullable(),
    items: z
        .array(z.any())
        .min(1, '最低1つのアイテムが必要です')
        .max(limits.items, `アイテムの最大数は${limits.items}個です。`),
    images: z
        .array(
            z.string().refine((img) => {
                const base64Data = img.includes(',')
                    ? img.split(',')[1] || ''
                    : img;
                const sizeInBytes = (base64Data.length * 3) / 4;
                return sizeInBytes <= 2 * 1024 * 1024;
            }, '画像サイズが大きすぎます。圧縮に失敗しているか、非対応画像の可能性があります。')
        )
        .max(1, '画像は最大1枚までです。')
        .nullable(),
});

export const setupErrorCheck = async (data: z.infer<typeof setupSchema>) => {
    const result = setupSchema.safeParse(data);

    if (!result.success) {
        const firstError = result.error.errors[0];
        if (firstError?.message) useToast().add(firstError.message);

        return true;
    }
    return false;
};

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
