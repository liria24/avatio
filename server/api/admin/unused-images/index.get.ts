interface UnusedImagesResponse {
    setupImages: string[]
    userImages: string[]
}

export default defineEventHandler(async (): Promise<UnusedImagesResponse> => {
    const { authorization }: { authorization?: string } =
        await getHeaders(useEvent())

    const config = useRuntimeConfig()
    if (authorization !== `Bearer ${config.adminKey}`) {
        console.error('Unauthorized access attempt to unused images list')
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden.',
        })
    }

    const storage = imageStorageClient()
    const supabase = await getSupabaseServerClient()

    // Get unused setup images
    const getUnusedSetupImages = async (): Promise<string[]> => {
        try {
            const { data, error } = await supabase
                .from('setup_images')
                .select('name')

            if (error) {
                console.error(
                    'Error fetching setup images from Supabase:',
                    error
                )
                return []
            }

            if (!data) return []

            const setupImages = new Set(data.map((i) => i.name))

            const storageImages: string[] = (await storage.keys('setup'))
                .map((image) => image.split(':').at(-1))
                .filter((image): image is string => Boolean(image))

            return storageImages.filter((image) => !setupImages.has(image))
        } catch (error) {
            console.error('Error getting unused setup images:', error)
            return []
        }
    }

    // Get unused user images
    const getUnusedUserImages = async (): Promise<string[]> => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('avatar')

            if (error) {
                console.error(
                    'Error fetching user images from Supabase:',
                    error
                )
                return []
            }

            if (!data) return []

            const userImages = new Set(
                data
                    .map((i) => i.avatar)
                    .filter((avatar): avatar is string =>
                        Boolean(avatar?.trim())
                    )
            )

            const storageUserImages: string[] = (await storage.keys('avatar'))
                .map((image) => image.split(':').at(-1))
                .filter((image): image is string => Boolean(image))

            return storageUserImages.filter((image) => !userImages.has(image))
        } catch (error) {
            console.error('Error getting unused user images:', error)
            return []
        }
    }

    try {
        const [setupImages, userImages] = await Promise.all([
            getUnusedSetupImages(),
            getUnusedUserImages(),
        ])

        return {
            setupImages,
            userImages,
        }
    } catch (error) {
        console.error('Error getting unused images list:', error)
        throw createError({
            statusCode: 500,
            statusMessage:
                'Internal server error while fetching unused images.',
        })
    }
})
