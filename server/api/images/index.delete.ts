import { z } from 'zod'

const query = z.object({
    path: z.string('Path must be a string').min(1, 'Path cannot be empty'),
})

export default defineApi(
    async () => {
        const { path } = await validateQuery(query)
        const target = path.split('/').join(':')

        console.log('Deleting image on storage:', target)

        try {
            await useStorage('r2').del(target)

            // 削除後の検証
            if (await useStorage('r2').has(target)) {
                console.error('Failed to delete image on storage:', target)
                throw createError({
                    statusCode: 500,
                    message: 'Delete operation on storage failed',
                })
            }

            return { path: target }
        } catch (error) {
            console.error('Error during image deletion:', error)
            throw createError({
                statusCode: 500,
                message: 'Failed to delete image: internal server error',
            })
        }
    },
    {
        errorMessage: 'Failed to delete image',
        requireAdmin: true,
    }
)
