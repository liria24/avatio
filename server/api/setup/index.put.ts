import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';
import type { H3Event } from 'h3';

const limits = setupLimits();

const setupSchema = z.object({
    name: z
        .string()
        .min(1, 'Title is required.')
        .max(limits.title, 'Title is too long.'),
    description: z
        .string()
        .max(limits.description, 'Description is too long.')
        .nullable()
        .optional(),
    tags: z.array(z.string().min(1)).max(limits.tags, 'Too many tags.'),
    coAuthors: z
        .array(
            z.object({
                id: z.string().uuid(),
                note: z
                    .string()
                    .max(limits.coAuthorsNote, 'Co-author note is too long.'),
            })
        )
        .max(limits.coAuthors, 'Too many co-authors.'),
    images: z
        .array(
            z
                .string()
                .refine(
                    (img) =>
                        Buffer.from(img.split(',')[1] || img, 'base64')
                            .length <=
                        2 * 1024 * 1024,
                    'Image is too large.'
                )
        )
        .max(1, 'Too many images.')
        .nullable()
        .optional(),
    og_image: z
        .object({
            positionX: z.number().optional(),
            positionY: z.number().optional(),
            width: z.number().optional(),
        })
        .optional(),
    unity: z
        .string()
        .regex(
            /^20\d{2}\.\d+\.\d+[fbap]\d+$/,
            'Invalid Unity version format. Expected format like: 2022.3.22f1'
        )
        .max(limits.unity, 'Unity version is too long.')
        .nullable()
        .optional(),
    items: z
        .array(
            z.object({
                id: z.number(),
                category: z.enum([
                    'avatar',
                    'cloth',
                    'accessory',
                    'other',
                    'hair',
                    'shader',
                    'texture',
                    'tool',
                ]),
                note: z
                    .string()
                    .max(limits.itemsNote, 'Item note is too long.'),
                shapekeys: z
                    .array(
                        z.object({
                            name: z
                                .string()
                                .max(
                                    limits.shapekeyName,
                                    'Too long shapekey name.'
                                ),
                            value: z.number(),
                        })
                    )
                    .max(limits.shapekeys, 'Too many shapekeys.')
                    .optional(),
                unsupported: z.boolean(),
            })
        )
        .min(1, 'Item is required.')
        .max(limits.items, 'Too many items.'),
});

export type RequestBody = z.infer<typeof setupSchema>;

// データベースエラー処理を簡素化するヘルパー関数
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleDbError = (table: string, error: any) => {
    console.error(`Failed to insert on DB. Table: ${table}`, error);
    throw createError({
        statusCode: 500,
        message: `Failed to insert on DB. Table: ${table}`,
    });
};

export default defineEventHandler(async (event: H3Event) => {
    const user = await serverSupabaseUser(event).catch(() => null);
    if (!user)
        throw createError({
            statusCode: 403,
            message: 'Forbidden.',
        });

    const supabase = await serverSupabaseClient<Database>(event);
    const rawBody = await readBody(event);

    const result = setupSchema.safeParse(rawBody);

    if (!result.success) {
        console.error('Validation error:', result.error.format());
        throw createError({
            statusCode: 400,
            message: `リクエストデータが不正です: ${result.error.issues.map((i) => i.message).join(', ')}`,
        });
    }

    const body = result.data;

    const { data: itemsDB, error: itemsError } = await supabase
        .from('items')
        .select('id, category')
        .in(
            'id',
            body.items.map((i) => i.id)
        );
    if (itemsError || !itemsDB) {
        console.error(
            'Internal item check failed:',
            itemsError || 'itemsDB is null'
        );
        throw createError({
            statusCode: 500,
            message: 'Internal item check failed.',
        });
    }

    const foundItemIds = new Set(itemsDB.map((item) => item.id));
    const requestedItemIds = body.items.map((item) => item.id);
    const missingItems = requestedItemIds.filter((id) => !foundItemIds.has(id));

    if (missingItems.length > 0) {
        throw createError({
            statusCode: 400,
            message: `Missing items: ${missingItems.join(', ')}`,
        });
    }

    const uploadedImages: {
        path: string;
        name: string;
        width?: number;
        height?: number;
    }[] = [];

    if (body.images?.length) {
        for (const img of body.images) {
            try {
                const response = await event.$fetch('/api/image', {
                    method: 'PUT',
                    body: { image: img, prefix: 'setup' },
                });

                uploadedImages.push(response);
            } catch (error) {
                console.error('Failed to upload image:', error);
                throw createError({
                    statusCode: 500,
                    message: 'Failed to upload image.',
                });
            }
        }
    }

    const { data: setupData, error: setupError } = await supabase
        .from('setups')
        .insert({
            name: body.name,
            description: body.description || '',
            unity: body.unity?.length ? body.unity : null,
        })
        .select('id')
        .single();

    if (setupError || !setupData) handleDbError('setups', setupError);

    const insertOperations = [
        supabase
            .from('setup_tags')
            .insert(body.tags.map((tag) => ({ setup_id: setupData!.id, tag }))),
        supabase.from('setup_coauthors').insert(
            body.coAuthors.map((coauthor) => ({
                setup_id: setupData!.id,
                user_id: coauthor.id,
                note: coauthor.note,
            }))
        ),
    ];

    const [{ error: tagsError }, { error: coAuthorError }] =
        await Promise.all(insertOperations);

    if (tagsError) handleDbError('setup_tags', tagsError);
    if (coAuthorError) handleDbError('setup_coauthors', coAuthorError);

    for (const item of body.items) {
        const { data: itemData, error: itemError } = await supabase
            .from('setup_items')
            .insert({
                setup_id: setupData!.id,
                item_id: item.id,
                note: item.note,
                unsupported: item.unsupported,
                category: item.category,
            })
            .select()
            .maybeSingle();

        if (itemError || !itemData) handleDbError('setup_items', itemError);

        if (item.shapekeys?.length) {
            const shapekeyOperations = item.shapekeys.map((shapekey) =>
                supabase.from('setup_item_shapekeys').insert({
                    setup_item_id: itemData!.id,
                    name: shapekey.name,
                    value: shapekey.value,
                })
            );

            const shapekeyResults = await Promise.all(shapekeyOperations);

            for (const result of shapekeyResults)
                if (result.error)
                    handleDbError('setup_shapekeys', result.error);
        }
    }

    if (uploadedImages.length) {
        for (const img of uploadedImages) {
            const { error: imageError } = await supabase
                .from('setup_images')
                .insert({
                    name: img.name,
                    setup_id: setupData!.id,
                    width: img.width,
                    height: img.height,
                });
            if (imageError) handleDbError('setup_images', imageError);
        }
    }

    if (body.og_image) {
        const { error: ogImageError } = await supabase
            .from('setup_og_image')
            .insert({
                setup_id: setupData!.id,
                image: uploadedImages[0].name,
                position_x: body.og_image.positionX || 50,
                position_y: body.og_image.positionY || 50,
                width: body.og_image.width || 100,
            });
        if (ogImageError) handleDbError('setup_og_image', ogImageError);
    }

    setResponseStatus(event, 201);
    return { id: setupData!.id };
});
