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
    image: z
        .string()
        .nullable()
        .refine(
            (file) => !file || file.length <= 4.5 * 1024 * 1024,
            '画像サイズが大きすぎます。3.5MB以下の画像が推奨されます。'
        ),
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
