import { z } from 'zod'

const query = z.object({
    path: z.string('Path must be a string').min(1, 'Path cannot be empty'),
})

export default adminSessionEventHandler(async () => {
    const { path } = await validateQuery(query)
    const target = path.split('/').join(':')

    console.log('Deleting image on storage:', target)

    try {
        await s3.delete(path)

        // 削除後の検証
        if (await s3.exists(path)) {
            console.error('Failed to delete image on storage:', target)
            throw createError({
                status: 500,
                statusText: 'Delete operation on storage failed',
            })
        }

        return { path: target }
    } catch (error) {
        console.error('Error during image deletion:', error)
        throw createError({
            status: 500,
            statusText: 'Failed to delete image: internal server error',
        })
    }
})
