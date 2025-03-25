import crypto from 'crypto';
import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';

const generateSecureRandomString = (length: number) => {
    return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event);
    const supabase = await serverSupabaseServiceRole(event);

    if (!user?.id) {
        console.error('Error: Needs login');
        return {
            code: null,
        };
    }

    const { data: oldData } = await supabase
        .from('shop_verification')
        .select('code, user_id, created_at')
        .eq('user_id', user.id);

    if (oldData?.length) {
        await supabase
            .from('shop_verification')
            .delete()
            .eq('user_id', user.id);
    }

    const code = generateSecureRandomString(64);

    const { data } = await supabase
        .from('shop_verification')
        .insert({
            code: code,
            user_id: user.id,
        })
        .select();

    if (!data) {
        console.error('Error: Failed to insert code');
        return {
            code: null,
        };
    }

    return {
        code: code,
    };
});
