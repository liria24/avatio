export default async (provider: 'github' | 'twitter') => {
    await authClient.signIn.social({ provider })
}
