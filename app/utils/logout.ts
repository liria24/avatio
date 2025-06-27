export default async () => {
    const localePath = useLocalePath()
    const result = await authClient.signOut()
    if (result.data?.success) {
        const session = await useGetSession()
        session.value = null
        navigateTo(localePath('/'))
    }
}
