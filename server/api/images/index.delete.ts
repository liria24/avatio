import { head, remove } from '@tigrisdata/storage'
import { z } from 'zod'

const query = z.object({
    path: z.string('Path must be a string').min(1, 'Path cannot be empty'),
})

export default adminSessionEventHandler(async () => {
    const { path } = await validateQuery(query)
    const target = path.split('/').join(':')

    console.log('Deleting image on storage:', target)

    try {
        await remove(path)

        // 削除後の検証
        if ((await head(path)).data) {
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
