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

        const rawBody = await readBody(event);
        const result = requestBodySchema.safeParse(rawBody);

        if (!result.success) {
            console.error('Validation error:', result.error.format());
            throw createError({
                statusCode: 400,
                message: `リクエストデータが不正です: ${result.error.issues.map((i) => i.message).join(', ')}`,
            });
        }

        const body = result.data;

        try {
            // クライアント側で圧縮済みの画像をデコード
            const input = Buffer.from(
                body.image.split(',')[1] || body.image,
                'base64'
            );

            // サイズバリデーション
            if (input.length > 2 * 1024 * 1024)
                throw createError({
                    statusCode: 400,
                    message: `画像サイズが大きすぎます。2MB以下にしてください。現在のサイズ: ${(input.length / (1024 * 1024)).toFixed(2)}MB`,
                });

            const dimensions = sizeOf(input);

            const unixTime = Math.floor(Date.now());
            let base64UnixTime = Buffer.from(unixTime.toString()).toString(
                'base64'
            );
            base64UnixTime = base64UnixTime.replace(/[\\/:*?"<>|]/g, '');

            const filename = `${base64UnixTime}.jpg`;
            const prefixedFileName = `${body.prefix}:${base64UnixTime}.jpg`;

            await storage.setItemRaw(prefixedFileName, input);

            if (!(await storage.has(prefixedFileName))) {
                console.error(
                    'Storage error: Failed to verify uploaded file existence:',
                    prefixedFileName
                );
                throw createError({
                    statusCode: 500,
                    message: 'Upload to R2 failed.',
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
