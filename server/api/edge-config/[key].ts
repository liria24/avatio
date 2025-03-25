import { get } from '@vercel/edge-config';

export default defineEventHandler(async (event) => {
    const key = getRouterParam(event, 'key');

    if (!key)
        return {
            message: 'No key provided',
            key: null,
            value: null,
            status: 400,
        };

    const value = await get(key);

    if (!value)
        return { message: 'Not found', key: key, value: null, status: 404 };

    return {
        message: 'Success',
        key: key,
        value: value,
        status: 200,
    };
});
