export const useGetSession = async () => {
    const { data: session } = await authClient.useSession((url, options) =>
        useFetch(url, { ...options, dedupe: 'defer' })
    )
    return session
}
