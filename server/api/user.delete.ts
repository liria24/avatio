import { serverSupabaseServiceRole } from '#supabase/server';
// import authMiddleware from './auth';

export default defineEventHandler(async (event) => {
    // const authenticated = await authMiddleware(event);
    // if (!authenticated)
    //     return sendError(
    //         event,
    //         createError({ statusCode: 403, statusMessage: 'Forbidden' })
    //     );

    const supabase = serverSupabaseServiceRole(event);

    const token = getHeader(event, 'authorization');
    const user = await supabase.auth.getUser(token);

    if (!user.data.user) {
        console.log('Invalid token');
        return sendError(
            event,
            createError({ statusCode: 403, statusMessage: 'Forbidden' })
        );
    }

    const body = await readBody(event);
    const plainPassword = body.plainPassword;

    const { data: checkPasswordResult } = await supabase.rpc('check_password', {
        user_id: user.data.user.id,
        plain_password: plainPassword,
    });

    if (!checkPasswordResult) {
        console.log('Invalid password');
        return sendError(
            event,
            createError({ statusCode: 401, statusMessage: 'Invalid password' })
        );
    }

    const { data, error } = await supabase.auth.admin.deleteUser(
        user.data.user.id
    );

    if (error) {
        console.error(error);
        return sendError(
            event,
            createError({
                statusCode: 500,
                statusMessage: 'Error on deleting user.',
            })
        );
    }

    return data;
});
