import { get } from '@vercel/edge-config';

export default defineEventHandler(async (event) => {
    const key = getRouterParam(event, 'key');

    if (!key)
        throw createError({
            statusCode: 400,
            message: 'No key provided',
        });

    const value = await get(key);

    return value;
});
