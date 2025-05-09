import crypto from 'crypto';
import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';

/**
 * Generate a secure random string
 */
const generateSecureRandomString = (length: number): string =>
    crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);

export default defineEventHandler(async (event): Promise<{ code: string }> => {
    try {
        const user = await serverSupabaseUser(event);

        if (!user?.id) {
            console.error('Error: User not authenticated');
            throw createError({
                statusCode: 403,
                message: 'Authentication required',
            });
        }

        const supabase = await serverSupabaseServiceRole<Database>(event);
        const userId = user.id;

        // Delete existing code if any
        const { error: deleteError } = await supabase
            .from('shop_verification')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error(
                'Error deleting existing verification code:',
                deleteError
            );
            // Continue execution even if deletion fails
        }

        // Generate and store new code
        const code = generateSecureRandomString(64);
        const { data, error: insertError } = await supabase
            .from('shop_verification')
            .insert({
                code,
                user_id: userId,
            })
            .select('code');

        if (insertError || !data?.length) {
            console.error('Error inserting verification code:', insertError);
            throw createError({
                statusCode: 500,
                message: 'Failed to generate verification code',
            });
        }

        // Return 201 Created for new resource creation
        setResponseStatus(event, 201);
        return { code };
    } catch (error) {
        // Re-throw if it's already a handled error
        if (error && (error as any).statusCode) throw error;

        console.error('Unexpected error generating code:', error);
        throw createError({
            statusCode: 500,
            message: 'An unexpected error occurred',
        });
    }
});
