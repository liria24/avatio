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
    ): Promise<
        ApiResponse<{
            path: string;
            prefix: string;
            width?: number;
            height?: number;
        }>
    > => {
        const storage = imageStorageClient();

        try {
            const user = await serverSupabaseUser(event);
            if (!user) throw new Error();
        } catch {
            return {
                error: { status: 403, message: 'Forbidden.' },
                data: null,
            };
        }

        const body: RequestBody = await readBody(event);

        if (!body.image || !body.image.length)
            return {
                error: { status: 400, message: 'No file provided.' },
                data: null,
            };

        if (!body.size || !body.resolution)
            return {
                error: {
                    status: 400,
                    message:
                        "Query parameter 'size' and 'resolution' are required.",
                },
                data: null,
            };

        try {
            const input = Buffer.from(
                body.image.split(',')[1] || body.image,
                'base64'
            );
            const image = sharp(input);

            if (isNaN(body.resolution) || body.resolution <= 0)
                return {
                    error: { status: 400, message: 'Invalid size parameter.' },
                    data: null,
                };

            let resolution = body.resolution;
            const width = (await image.metadata()).width;
            const height = (await image.metadata()).height;

            if (width && height)
                if (Math.max(width, height) < body.resolution)
                    resolution = Math.max(width, height);

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
            if (!(await storage.has(fileNamePrefixed)))
                return {
                    error: { status: 500, message: 'Upload to R2 failed.' },
                    data: null,
                };

            return {
                error: null,
                data: {
                    path: fileName,
                    prefix: body.prefix,
                    width: metadata.width,
                    height: metadata.height,
                },
            };
        } catch (error) {
            console.error(error);
            return {
                error: {
                    status: 500,
                    message: "Unknown error. Couldn't upload image.",
                },
                data: null,
            };
        }
    }
);
