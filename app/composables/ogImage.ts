export const useOgImage = async (props: { title: string; description?: string }) => {
    if (!props.title.trim()) return undefined

    try {
        const response = await $fetch<{ url: string | null }>('/api/og-image/avatio', {
            method: 'POST',
            body: props,
        })

        return response.url ?? undefined
    } catch (error) {
        if (import.meta.server) logger('useOgImage').warn('Failed to issue OG image URL', error)
        return undefined
    }
}
