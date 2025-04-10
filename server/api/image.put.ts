import sharp from 'sharp';
import { serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestBodySchema = z.object({
    image: z
        .string({
            required_error: 'No file provided.',
        })
        .min(1, 'No file provided.'),
    target: z.enum(['setup', 'avatar'], {
        required_error: "Query parameter 'target' is required.",
        invalid_type_error: "Target must be either 'setup' or 'avatar'.",
    }),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(
    async (
        event
    ): Promise<{
        path: string;
        target: 'setup' | 'avatar';
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

            // サイズ制限の設定（MB）
            const sizeLimits: Record<string, number> = {
                setup: 5,
                avatar: 1.5,
            };

            // サイズバリデーション
            if (input.length > sizeLimits[body.target] * 1024 * 1024)
                throw createError({
                    statusCode: 400,
                    message: `画像サイズが大きすぎます。${sizeLimits[body.target]}MB以下にしてください。現在のサイズ: ${(input.length / (1024 * 1024)).toFixed(2)}MB`,
                });

            const metadata = await sharp(input).metadata();

            const unixTime = Math.floor(Date.now());
            let base64UnixTime = Buffer.from(unixTime.toString()).toString(
                'base64'
            );
            base64UnixTime = base64UnixTime.replace(/[\\/:*?"<>|]/g, '');

            const fileName = `${body.target}:${base64UnixTime}.jpg`;

            await storage.setItemRaw(fileName, input);

            if (!(await storage.has(fileName))) {
                console.error(
                    'Storage error: Failed to verify uploaded file existence:',
                    fileName
                );
                throw createError({
                    statusCode: 500,
                    message: 'Upload to R2 failed.',
                });
            }

            setResponseStatus(event, 201);

            return {
                path: fileName,
                target: body.target,
                width: metadata.width,
                height: metadata.height,
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
