import sharp from 'sharp';
import { z } from 'zod';
import { createError } from 'h3';

const querySchema = z.object({
    crop: z
        .string()
        .regex(/^(\d+(\.\d+)?),(\d+(\.\d+)?),(\d+(\.\d+)?)$/)
        .refine(
            (val) => {
                const [x, y, width] = val.split(',').map(Number);
                return (
                    x >= 0 &&
                    x <= 100 &&
                    y >= 0 &&
                    y <= 100 &&
                    width > 0 &&
                    width <= 100
                );
            },
            {
                message:
                    'x,y,width値は全て0〜100の範囲（パーセント）である必要があります（widthは0より大きい必要があります）',
            }
        )
        .optional(), // x,y,width形式（全て0-100%、heightはwidthから自動計算）
});

export default defineEventHandler(async (event) => {
    const name = getRouterParam(event, 'name');

    if (!name) {
        console.error('画像名が指定されていません');
        throw createError({
            statusCode: 400,
            message: '画像名が指定されていません',
        });
    }

    const config = useRuntimeConfig();

    try {
        // クエリパラメータの取得と検証
        const query = getQuery(event);
        const { crop } = querySchema.parse(query);

        const img = name.split('/').map(encodeURIComponent).join('/');

        // URLから画像を取得
        const response = await $fetch<Blob>(
            `${config.public.r2.domain}/setup/${img}`,
            { responseType: 'blob' }
        );

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        let sharpInstance = sharp(imageBuffer);

        // 画像のメタデータを取得
        const metadata = await sharpInstance.metadata();

        if (!metadata.width || !metadata.height) {
            console.error('画像メタデータの取得に失敗しました');
            throw createError({
                statusCode: 500,
                message: '画像の処理中にエラーが発生しました',
            });
        }

        // クロップが指定されている場合の処理
        if (crop) {
            const [xPercent, yPercent, widthPercent] = crop
                .split(',')
                .map(Number);

            // 幅をピクセル値に変換（高さはアスペクト比から計算）
            const width = Math.round((widthPercent / 100) * metadata.width);
            const height = Math.round(width / 1.91); // アスペクト比1.91:1を維持

            // パーセント値から実際の座標を計算
            const x = Math.round((xPercent / 100) * (metadata.width - width));
            const y = Math.round((yPercent / 100) * (metadata.height - height));

            // 値の境界チェック
            const validX = Math.max(0, Math.min(x, metadata.width - 1));
            const validY = Math.max(0, Math.min(y, metadata.height - 1));
            const validWidth = Math.min(width, metadata.width - validX);
            const validHeight = Math.min(height, metadata.height - validY);

            // クロップサイズが有効かチェック
            if (validWidth <= 0 || validHeight <= 0) {
                console.error('有効なクロップ領域を計算できません', {
                    originalParams: { xPercent, yPercent, widthPercent },
                    imageSize: {
                        width: metadata.width,
                        height: metadata.height,
                    },
                });
                throw createError({
                    statusCode: 400,
                    message:
                        '有効なクロップ領域を計算できません。別のクロップパラメータを指定してください。',
                });
            }

            // 計算された領域でクロップ
            sharpInstance = sharpInstance.extract({
                left: validX,
                top: validY,
                width: validWidth,
                height: validHeight,
            });
        }

        // 1200x630にリサイズ
        sharpInstance = sharpInstance.resize(1200, 630, {
            fit: 'cover',
            position: 'center',
        });

        // 常にPNG形式で出力
        const outputBuffer = await sharpInstance
            .png({ quality: 90 })
            .toBuffer();

        setHeader(event, 'Content-Type', 'image/png');
        setHeader(event, 'Cache-Control', 'public, max-age=86400');

        return outputBuffer;
    } catch (error) {
        console.error('OGP画像生成エラー:', error);

        if (error instanceof Error) {
            console.error('エラー詳細:', error.message, error.stack);
        }

        throw createError({
            statusCode: 500,
            message: 'OGP画像の生成中にエラーが発生しました',
        });
    }
});
