import sharp from 'sharp';
import { serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestBodySchema = z.object({
    // 画像データ（Base64文字列）
    image: z
        .string({
            required_error: 'No file provided.',
        })
        .min(1, 'No file provided.'),

    size: z
        .number({
            required_error: "Query parameter 'size' is required.",
            invalid_type_error: 'Size must be a number.',
        })
        .positive('Size must be a positive number.'),

    resolution: z
        .number({
            required_error: "Query parameter 'resolution' is required.",
            invalid_type_error: 'Resolution must be a number.',
        })
        .positive('Resolution must be a positive number.'),

    prefix: z.string(),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(
    async (
        event
    ): Promise<{
        path: string;
        prefix: string;
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
            const input = Buffer.from(
                body.image.split(',')[1] || body.image,
                'base64'
            );
            const image = sharp(input);

            let resolution = body.resolution;
            const width = (await image.metadata()).width;
            const height = (await image.metadata()).height;

            if (width && height) {
                if (Math.max(width, height) < body.resolution) {
                    resolution = Math.max(width, height);
                }
            }

            const compressed = await image
                .resize({
                    width: resolution,
                    height: resolution,
                    fit: 'inside',
                })
                .toFormat('jpeg')
                .toBuffer();

            const metadata = await sharp(compressed).metadata();

            const unixTime = Math.floor(Date.now());
            let base64UnixTime = Buffer.from(unixTime.toString()).toString(
                'base64'
            );
            base64UnixTime = base64UnixTime.replace(/[\\/:*?"<>|]/g, '');

            const fileName = `${base64UnixTime}.jpg`;
            const fileNamePrefixed = `${body.prefix.length ? `${body.prefix}:` : ''}${fileName}`;

            await storage.setItemRaw(fileNamePrefixed, compressed);

            if (!(await storage.has(fileNamePrefixed))) {
                console.error(
                    'Storage error: Failed to verify uploaded file existence:',
                    fileNamePrefixed
                );
                throw createError({
                    statusCode: 500,
                    message: 'Upload to R2 failed.',
                });
            }

            // 画像アップロード成功時は201 Created
            setResponseStatus(event, 201);

            // 直接データオブジェクトを返す
            return {
                path: fileName,
                prefix: body.prefix,
                width: metadata.width,
                height: metadata.height,
            };
        } catch (error) {
            console.error('Image processing or upload error:', error);
            throw createError({
                statusCode: 500,
                message: "Unknown error. Couldn't upload image.",
            });
        }
    }
);
