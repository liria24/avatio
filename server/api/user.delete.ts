import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';
import type { User } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
    let user: User | null;
    try {
        user = await serverSupabaseUser(event);
        if (!user) {
            throw createError({
                statusCode: 403,
                message: 'Forbidden.',
            });
        }
    } catch {
        throw createError({
            statusCode: 403,
            message: 'Forbidden.',
        });
    }

    const supabase = serverSupabaseServiceRole<Database>(event);

    // const body = await readBody(event);
    // const plainPassword = body.plainPassword;

    // const { data: checkPasswordResult, error: checkPasswordError } =
    //     await supabase.rpc('check_password', {
    //         user_id: user.id,
    //         plain_password: plainPassword,
    //     });

    // if (checkPasswordError) {
    //     console.error(checkPasswordError);
    //     throw createError({
    //         statusCode: 500,
    //         message: 'Error on checking password.'
    //     });
    // }

    // if (!checkPasswordResult) {
    //     console.error('Invalid password');
    //     throw createError({
    //         statusCode: 401,
    //         message: 'Invalid password'
    //     });
    // }

    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Error on deleting user.',
        });
    }

    // ユーザー削除成功の場合、204 No Content が適切
    setResponseStatus(event, 204);
    return null;
});
