import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';
import type { H3Event } from 'h3';

export interface RequestBody {
    name: string;
    description: string;
    tags: string[];
    coAuthors: { id: string; note: string }[];
    image: string | null;
    unity?: string;
    items: {
        id: number;
        category: ItemCategory;
        note: string;
        unsupported: boolean;
    }[];
}

export default defineEventHandler(async (event: H3Event) => {
    const user = await serverSupabaseUser(event).catch(() => null);
    if (!user) {
        throw createError({
            statusCode: 403,
            message: 'Forbidden.',
        });
    }

    const supabase = await serverSupabaseClient<Database>(event);
    const rawBody = await readBody(event);
    const limits = setupLimits();

    const setupSchema = z.object({
        name: z
            .string()
            .min(1, 'Title is required.')
            .max(limits.title, 'Title is too long.'),
        description: z
            .string()
            .max(limits.description, 'Description is too long.')
            .nullable(),
        tags: z.array(z.string().min(1)).max(limits.tags, 'Too many tags.'),
        coAuthors: z
            .array(
                z.object({
                    id: z.string(),
                    note: z
                        .string()
                        .max(
                            limits.coAuthorsNote,
                            'Co-author note is too long.'
                        ),
                })
            )
            .max(limits.coAuthors, 'Too many co-authors.'),
        image: z.string().nullable(),
        unity: z
            .string()
            .max(limits.unity, 'Unity version is too long.')
            .nullable(),
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
                    unsupported: z.boolean(),
                })
            )
            .min(1, 'Item is required.')
            .max(limits.items, 'Too many items.'),
    });

    const result = setupSchema.safeParse(rawBody);

    if (!result.success) {
        throw createError({
            statusCode: 400,
            message: result.error.issues[0]?.message || 'Invalid request data',
        });
    }

    const body = result.data;

    const { data: itemsDB } = await supabase
        .from('items')
        .select('id, category')
        .in(
            'id',
            body.items.map((i) => i.id)
        );
    if (!itemsDB) {
        console.error('Internal item check failed: itemsDB is null');
        throw createError({
            statusCode: 500,
            message: 'Internal item check failed.',
        });
    }

    let image: {
        path: string;
        prefix: string;
        width?: number;
        height?: number;
    } | null = null;

    if (body.image) {
        try {
            const response = await event.$fetch('/api/image', {
                method: 'PUT',
                body: {
                    image: body.image,
                    resolution: 1920,
                    size: 1500,
                    prefix: 'setup',
                },
            });

            image = response;
        } catch (error) {
            console.error('Failed to upload image:', error);
            throw createError({
                statusCode: 500,
                message: 'Failed to upload image.',
            });
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

    if (setupError) {
        console.error('Failed to insert on DB. Table: setups', setupError);
        throw createError({
            statusCode: 500,
            message: 'Failed to insert on DB. Table: setups',
        });
    }

    const insertOperations = [
        supabase.from('setup_items').insert(
            body.items.map((i) => ({
                setup_id: setupData.id,
                item_id: i.id,
                note: i.note,
                unsupported: i.unsupported,
                category: i.category,
            }))
        ),
        supabase
            .from('setup_tags')
            .insert(body.tags.map((tag) => ({ setup_id: setupData.id, tag }))),
        supabase.from('setup_coauthors').insert(
            body.coAuthors.map((coauthor) => ({
                setup_id: setupData.id,
                user_id: coauthor.id,
                note: coauthor.note,
            }))
        ),
    ];

    const [
        { error: itemsError },
        { error: tagsError },
        { error: coAuthorError },
    ] = await Promise.all(insertOperations);

    if (itemsError) {
        console.error('Failed to insert on DB. Table: setup_items', itemsError);
        throw createError({
            statusCode: 500,
            message: 'Failed to insert on DB. Table: setup_items',
        });
    }
    if (tagsError) {
        console.error('Failed to insert on DB. Table: setup_tags', tagsError);
        throw createError({
            statusCode: 500,
            message: 'Failed to insert on DB. Table: setup_tags',
        });
    }
    if (coAuthorError) {
        console.error(
            'Failed to insert on DB. Table: setup_coauthors',
            coAuthorError
        );
        throw createError({
            statusCode: 500,
            message: 'Failed to insert on DB. Table: setup_coauthors',
        });
    }

    if (image) {
        const { error: imageError } = await supabase
            .from('setup_images')
            .insert({
                name: image.path,
                setup_id: setupData.id,
                width: image.width,
                height: image.height,
            });
        if (imageError) {
            console.error(
                'Failed to insert on DB. Table: setup_images',
                imageError
            );
            throw createError({
                statusCode: 500,
                message: 'Failed to insert on DB. Table: setup_images',
            });
        }
    }

    setResponseStatus(event, 201);
    return {
        id: setupData.id,
        image: image ? image.path : null,
    };
});
