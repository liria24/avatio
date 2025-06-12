import {
    serverSupabaseClient,
    serverSupabaseServiceRole,
} from '#supabase/server'

export const getSupabaseServerClient = async () => {
    const supabase = await serverSupabaseClient<Database>(useEvent())
    return supabase
}

export const getSupabaseServiceRoleClient = async () => {
    const supabase = await serverSupabaseServiceRole<Database>(useEvent())
    return supabase
}
