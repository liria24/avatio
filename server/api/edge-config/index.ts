import { getAll } from '@vercel/edge-config';

export default defineEventHandler(async (_event) => {
    const value = await getAll();

    if (!value) return { message: 'Not found', value: null, status: 404 };

    return {
        message: 'Success',
        value: value,
        status: 200,
    };
});
