import { createStorage } from 'unstorage'
import s3Driver from 'unstorage/drivers/s3'
import { z } from 'zod/v4'

const query = z.object({
    path: z.string('Path must be a string').min(1, 'Path cannot be empty'),
})

export default defineApi(
    async () => {
        const config = useRuntimeConfig()

        const storage = createStorage({
            driver: s3Driver({
                accessKeyId: config.r2.accessKey,
                secretAccessKey: config.r2.secretKey,
                endpoint: config.r2.endpoint,
                bucket: 'avatio',
                region: 'auto',
            }),
        })

        const { path } = await validateQuery(query)
        const target = path.split('/').join(':')

        console.log('Deleting image on storage:', target)

        try {
            await storage.del(target)

            // 削除後の検証
            if (await storage.has(target)) {
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
