import { getAll } from '@vercel/edge-config';

export default defineEventHandler(async (_event) => {
    const value = await getAll();

    if (!value)
        throw createError({
            statusCode: 404,
            message: 'Edge Config not found',
        });

    return value;
});
