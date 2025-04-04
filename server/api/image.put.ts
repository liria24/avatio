import sharp from 'sharp';
import { serverSupabaseUser } from '#supabase/server';

export interface RequestBody {
    image: string;
    size: number;
    resolution: number;
    prefix: string;
}

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

        const body: RequestBody = await readBody(event);

        if (!body.image || !body.image.length) {
            console.error('Validation error: No image provided');
            throw createError({
                statusCode: 400,
                message: 'No file provided.',
            });
        }

        if (!body.size || !body.resolution) {
            console.error(
                'Validation error: Missing size or resolution parameters'
            );
            throw createError({
                statusCode: 400,
                message:
                    "Query parameter 'size' and 'resolution' are required.",
            });
        }

        if (isNaN(body.resolution) || body.resolution <= 0) {
            console.error(
                'Validation error: Invalid resolution parameter:',
                body.resolution
            );
            throw createError({
                statusCode: 400,
                message: 'Invalid size parameter.',
            });
        }

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
