import { serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';
import sizeOf from 'image-size';

const requestBodySchema = z.object({
    image: z
        .string({
            required_error: 'No file provided.',
        })
        .min(1, 'No file provided.'),
    prefix: z.enum(['setup', 'avatar'], {
        required_error: 'No target provided.',
        invalid_type_error: 'Invalid target provided.',
    }),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(
    async (
        event
    ): Promise<{
        path: string;
        name: string;
        prefix: 'setup' | 'avatar';
        width?: number;
        height?: number;
    }> => {
        const storage = imageStorageClient();

        // Authenticate user
        try {
            const user = await serverSupabaseUser(event);
            if (!user) {
                console.error('Authentication failed: User not found');
                throw createError({
                    statusCode: 403,
                    message: 'Forbidden.',
                });
            }
        } catch (error) {
            console.error('Authentication error:', error);
            throw createError({
                statusCode: 403,
                message: 'Forbidden.',
            });
        }

        // Validate request body
        const rawBody = await readBody(event);
        const result = requestBodySchema.safeParse(rawBody);

        if (!result.success) {
            console.error('Validation error:', result.error.format());
            throw createError({
                statusCode: 400,
                message: `Invalid request data: ${result.error.issues.map((i) => i.message).join(', ')}`,
            });
        }

        const body = result.data;

        try {
            // Decode the compressed image from client
            const base64Data = body.image.includes(',')
                ? body.image.split(',')[1]
                : body.image;

            const input = Buffer.from(base64Data, 'base64');

            // Size validation
            const maxSizeMB = 2;
            const sizeInMB = input.length / (1024 * 1024);
            if (sizeInMB > maxSizeMB) {
                console.error(
                    `Image size exceeds limit: ${sizeInMB.toFixed(2)}MB`
                );
                throw createError({
                    statusCode: 400,
                    message: `Image is too large. Maximum size is ${maxSizeMB}MB. Current size: ${sizeInMB.toFixed(2)}MB`,
                });
            }

            const dimensions = sizeOf(input);

            // Generate unique filename using timestamp
            const unixTime = Math.floor(Date.now());
            const base64UnixTime = Buffer.from(unixTime.toString())
                .toString('base64')
                .replace(/[\\/+=]/g, ''); // Remove problematic base64 chars

            const extension = 'jpg'; // Consider detecting actual format
            const filename = `${base64UnixTime}.${extension}`;
            const prefixedFileName = `${body.prefix}:${filename}`;

            // Upload to storage
            await storage.setItemRaw(prefixedFileName, input);

            // Verify upload success
            if (!(await storage.has(prefixedFileName))) {
                console.error(
                    'Storage error: Failed to verify uploaded file existence:',
                    prefixedFileName
                );
                throw createError({
                    statusCode: 500,
                    message: 'Upload to storage failed.',
                });
            }

            setResponseStatus(event, 201);

            return {
                path: prefixedFileName,
                name: filename,
                prefix: body.prefix,
                width: dimensions.width,
                height: dimensions.height,
            };
        } catch (error) {
            console.error('Image processing or upload error:', error);
            throw createError({
                statusCode: 500,
                message:
                    error instanceof Error
                        ? error.message
                        : "Unknown error. Couldn't upload image.",
            });
        }
    }
);
