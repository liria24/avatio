interface UserProfile {
    id: string | null;
    name: string | null;
    avatar: string | null;
    badges: Badge[];
}

export const userProfile = ref<UserProfile>({
    id: null,
    name: null,
    avatar: null,
    badges: [],
});

export const useSignOut = async () => {
    const supabase = useSupabaseClient();
    await supabase.auth.signOut();
    navigateTo('/');
};

export const useLogin = async (
    email: string,
    password: string,
    token: string
) => {
    const supabase = useSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
        options: { captchaToken: token },
    });
    if (error) throw error;
};

export const useSignUp = async (
    email: string,
    password: string,
    token: string
) => {
    const supabase = useSupabaseClient();

    const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { captchaToken: token },
    });
    if (error) throw error;

    useToast().add('サインアップしました。');
};

export const useLoginWithTwitter = async () => {
    const supabase = useSupabaseClient();

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
    });

    if (error) {
        navigateTo('/login');
        useToast().add('ログインに失敗しました。');
    }
};
