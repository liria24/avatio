import sizeOf from 'image-size'
import { z } from 'zod/v4'

const body = z.object({
    image: z.string('No file provided.').min(1, 'Image cannot be empty.'),
    prefix: z.enum(
        ['setup', 'avatar'],
        'Invalid prefix. Must be "setup" or "avatar".'
    ),
})

export default defineEventHandler(
    async (
        event
    ): Promise<{
        path: string
        name: string
        prefix: 'setup' | 'avatar'
        width?: number
        height?: number
    }> => {
        const storage = imageStorageClient()

        await checkSupabaseUser()

        const { image, prefix } = await validateBody(body)

        try {
            // Decode the compressed image from client
            const base64Data = image.includes(',') ? image.split(',')[1] : image

            const input = Buffer.from(base64Data, 'base64')

            // Size validation
            const maxSizeMB = 2
            const sizeInMB = input.length / (1024 * 1024)
            if (sizeInMB > maxSizeMB) {
                console.error(
                    `Image size exceeds limit: ${sizeInMB.toFixed(2)}MB`
                )
                throw createError({
                    statusCode: 400,
                    message: `Image is too large. Maximum size is ${maxSizeMB}MB. Current size: ${sizeInMB.toFixed(2)}MB`,
                })
            }

            const dimensions = sizeOf(input)

            // Generate unique filename using timestamp
            const unixTime = Math.floor(Date.now())
            const base64UnixTime = Buffer.from(unixTime.toString())
                .toString('base64')
                .replace(/[\\/+=]/g, '') // Remove problematic base64 chars

            const extension = 'jpg' // Consider detecting actual format
            const filename = `${base64UnixTime}.${extension}`
            const prefixedFileName = `${prefix}:${filename}`

            // Upload to storage
            await storage.setItemRaw(prefixedFileName, input)

            // Verify upload success
            if (!(await storage.has(prefixedFileName))) {
                console.error(
                    'Storage error: Failed to verify uploaded file existence:',
                    prefixedFileName
                )
                throw createError({
                    statusCode: 500,
                    message: 'Upload to storage failed.',
                })
            }

            setResponseStatus(event, 201)

            return {
                path: prefixedFileName,
                name: filename,
                prefix: prefix,
                width: dimensions.width,
                height: dimensions.height,
            }
        } catch (error) {
            console.error('Image processing or upload error:', error)
            throw createError({
                statusCode: 500,
                message:
                    error instanceof Error
                        ? error.message
                        : "Unknown error. Couldn't upload image.",
            })
        }
    }
)
