interface CompressImageMessage {
    type: 'compress';
    imageData: string;
    resolution: number;
    maxSize: number;
}

// リサイズ後のサイズを計算する関数（image.tsと同じロジック）
function calculateResizedDimensions(
    originalWidth: number,
    originalHeight: number,
    resolution: number
): { width: number; height: number } {
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (Math.max(originalWidth, originalHeight) > resolution) {
        const aspectRatio = originalWidth / originalHeight;
        if (originalWidth > originalHeight) {
            targetWidth = resolution;
            targetHeight = Math.round(resolution / aspectRatio);
        } else {
            targetHeight = resolution;
            targetWidth = Math.round(resolution * aspectRatio);
        }
    }

    return { width: targetWidth, height: targetHeight };
}

// 最適な圧縮品質を見つける関数（image.tsと共通の実装）
async function findOptimalCompression(
    compressFn: (quality: number) => Promise<Blob>,
    maxSizeBytes: number,
    onIterationProgress?: (iteration: number) => void
) {
    let minQuality = 20;
    let maxQuality = 90;
    let bestQuality = minQuality;
    let bestBlob: Blob | null = null;

    // 最初に高品質で試す
    let currentQuality = maxQuality;
    let blob = await compressFn(currentQuality);

    if (blob.size <= maxSizeBytes) {
        bestBlob = blob;
        bestQuality = currentQuality;
    } else {
        // 二分探索で最適な品質を探す
        for (let i = 0; i < 5; i++) {
            if (onIterationProgress) {
                onIterationProgress(i);
            }

            currentQuality = Math.floor((minQuality + maxQuality) / 2);
            blob = await compressFn(currentQuality);

            if (blob.size <= maxSizeBytes) {
                bestBlob = blob;
                bestQuality = currentQuality;
                minQuality = currentQuality;
            } else {
                maxQuality = currentQuality - 1;
            }

            if (maxQuality - minQuality <= 2) break;
        }

        // 適切な品質が見つからなかった場合
        if (!bestBlob) {
            bestQuality = minQuality;
            bestBlob = await compressFn(minQuality);
        }
    }

    return {
        bestQuality,
        bestBlob,
    };
}

self.onmessage = async (e: MessageEvent<CompressImageMessage>) => {
    if (e.data.type === 'compress') {
        const { imageData, resolution, maxSize } = e.data;

        try {
            // 進捗通知
            postMessage({
                type: 'progress',
                stage: '画像読み込み中',
                percent: 10,
            });

            // Base64からblobへ変換
            const fetchResp = await fetch(imageData);
            const fetchedBlob = await fetchResp.blob();

            // ImageBitmapを作成（ハードウェアアクセラレーション可能）
            const originalImage = await createImageBitmap(fetchedBlob);

            // 元のサイズを取得
            const originalWidth = originalImage.width;
            const originalHeight = originalImage.height;

            // リサイズ計算
            postMessage({
                type: 'progress',
                stage: 'リサイズ処理中',
                percent: 30,
            });

            // 共通関数を使用してリサイズ後のサイズを計算
            const { width: targetWidth, height: targetHeight } =
                calculateResizedDimensions(
                    originalWidth,
                    originalHeight,
                    resolution
                );

            // Offscreen Canvasの作成
            const canvas = new OffscreenCanvas(targetWidth, targetHeight);
            const ctx = canvas.getContext('2d', {
                alpha: false,
                desynchronized: true,
                willReadFrequently: false,
            });

            if (!ctx) throw new Error('Canvas contextの取得に失敗しました');

            // 高品質リサイズの実行
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);

            // 画像圧縮の実行
            postMessage({ type: 'progress', stage: '画像圧縮中', percent: 60 });

            // 品質に応じた圧縮関数
            const compressWithQuality = async (
                quality: number
            ): Promise<Blob> => {
                return await canvas.convertToBlob({
                    type: 'image/jpeg',
                    quality: quality / 100,
                });
            };

            // 共通の二分探索関数を使用して最適な圧縮を見つける
            const result = await findOptimalCompression(
                compressWithQuality,
                maxSize || 1.5 * 1024 * 1024,
                (i) => {
                    postMessage({
                        type: 'progress',
                        stage: `圧縮最適化中 (${i + 1}/5)`,
                        percent: 60 + i * 8,
                    });
                }
            );

            postMessage({ type: 'progress', stage: '完了', percent: 100 });

            // 結果をArrayBufferとして送信
            const arrayBuffer = await result.bestBlob!.arrayBuffer();
            postMessage(
                {
                    type: 'result',
                    quality: result.bestQuality,
                    size: result.bestBlob!.size,
                    data: arrayBuffer,
                    width: targetWidth,
                    height: targetHeight,
                },
                { transfer: [arrayBuffer] }
            );
        } catch (error) {
            postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
};
