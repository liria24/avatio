import { z } from 'zod/v4'

const query = z.object({
    name: z.string('Name must be a string').min(1, 'Name cannot be empty'),
    prefix: z.string('Prefix must be a string').optional(),
})

export default defineEventHandler(async (): Promise<{ path: string }> => {
    const storage = imageStorageClient()

    await checkSupabaseUser()

    const { name, prefix } = await validateQuery(query)
    const target = prefix ? `${prefix}:${name}` : name

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
})
