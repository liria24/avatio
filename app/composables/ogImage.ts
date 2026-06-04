import type { AvatioImageProps } from '@avatio/og-image/client'

interface AvatioOgImageResponse {
    url: string | null
}

export const useAvatioOgImage = async (props: AvatioImageProps): Promise<string | undefined> => {
    if (!props.title.trim()) return undefined

    try {
        const response = await $fetch<AvatioOgImageResponse>('/api/og-image/avatio', {
            method: 'POST',
            body: props,
        })

        return response.url ?? undefined
    } catch (error) {
        if (import.meta.server)
            logger('useAvatioOgImage').warn('Failed to issue OG image URL', error)
        return undefined
    }
}
