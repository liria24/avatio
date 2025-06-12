interface CleanupResult {
    completed: string[]
    failed: string[]
}

interface CleanupResponse {
    setupImages: CleanupResult
    userImages: CleanupResult
}

export default defineEventHandler(async (): Promise<CleanupResponse> => {
    const { authorization }: { authorization?: string } =
        await getHeaders(useEvent())

    const config = useRuntimeConfig()
    if (authorization !== `Bearer ${config.adminKey}`) {
        console.error('Unauthorized access attempt to unused images deletion')
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden.',
        })
    }

    const storage = imageStorageClient()
    const supabase = await getSupabaseServerClient()

    // Utility function to safely delete images
    const deleteImageSafely = async (
        prefix: string,
        image: string
    ): Promise<boolean> => {
        try {
            await storage.del(`${prefix}:${image}`)
            return !(await storage.has(`${prefix}:${image}`))
        } catch (error) {
            console.error(`Failed to delete ${prefix} image:`, image, error)
            return false
        }
    }

    // Setup images cleanup
    const cleanupSetupImages = async (): Promise<CleanupResult> => {
        const deleteCompleted: string[] = []
        const deleteFailed: string[] = []

        try {
            const { data, error } = await supabase
                .from('setup_images')
                .select('name')

            if (error) {
                console.error(
                    'Error fetching setup images from Supabase:',
                    error
                )
                return { completed: deleteCompleted, failed: deleteFailed }
            }

            if (!data)
                return { completed: deleteCompleted, failed: deleteFailed }

            const setupImages = new Set(data.map((i) => i.name))

            const storageImages: string[] = (await storage.keys('setup'))
                .map((image) => image.split(':').at(-1))
                .filter((image): image is string => Boolean(image))

            const unusedImages = storageImages.filter(
                (image) => !setupImages.has(image)
            )

            for (const image of unusedImages) {
                const deleteSuccess = await deleteImageSafely('setup', image)
                if (deleteSuccess) {
                    deleteCompleted.push(image)
                } else {
                    deleteFailed.push(image)
                }
            }
        } catch (error) {
            console.error('Error during setup images cleanup:', error)
        }

        return { completed: deleteCompleted, failed: deleteFailed }
    }

    // User images cleanup
    const cleanupUserImages = async (): Promise<CleanupResult> => {
        const deleteCompleted: string[] = []
        const deleteFailed: string[] = []

        try {
            const { data, error } = await supabase
                .from('users')
                .select('avatar')

            if (error) {
                console.error(
                    'Error fetching user images from Supabase:',
                    error
                )
                return { completed: deleteCompleted, failed: deleteFailed }
            }

            if (!data)
                return { completed: deleteCompleted, failed: deleteFailed }

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

            const unusedImages = storageUserImages.filter(
                (image) => !userImages.has(image)
            )

            for (const image of unusedImages) {
                const deleteSuccess = await deleteImageSafely('avatar', image)
                if (deleteSuccess) {
                    deleteCompleted.push(image)
                } else {
                    deleteFailed.push(image)
                }
            }
        } catch (error) {
            console.error('Error during user images cleanup:', error)
        }

        return { completed: deleteCompleted, failed: deleteFailed }
    }

    try {
        const [setupResult, userResult] = await Promise.all([
            cleanupSetupImages(),
            cleanupUserImages(),
        ])

        return {
            setupImages: setupResult,
            userImages: userResult,
        }
    } catch (error) {
        console.error('Error during unused images cleanup:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error during cleanup.',
        })
    }
})
