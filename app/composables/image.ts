import { PhotonImage, resize, SamplingFilter } from '@silvia-odwyer/photon';

/**
 * 画像圧縮処理のメインインターフェース
 */
export const useCompressImage = async (
    base64Image: string,
    resolution: number,
    options?: {
        maxSize?: number;
        onProgress?: (stage: string, percent: number) => void;
    }
): Promise<Blob> => {
    const maxSize = options?.maxSize || 1.5 * 1024 * 1024; // デフォルト1.5MB
    const onProgress = options?.onProgress || (() => {});

    // Web Worker対応チェック
    if (
        typeof Worker !== 'undefined' &&
        typeof OffscreenCanvas !== 'undefined'
    ) {
        return compressUsingWebWorker(
            base64Image,
            resolution,
            maxSize,
            onProgress
        );
    } else {
        console.warn(
            'Web WorkerまたはOffscreenCanvasがサポートされていません。メインスレッドでの処理にフォールバックします。'
        );
        return compressUsingMainThread(
            base64Image,
            resolution,
            maxSize,
            onProgress
        );
    }
};

/**
 * Web Worker環境での画像圧縮（Canvas利用）
 */
const compressUsingWebWorker = async (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        let worker: Worker;

        try {
            // Web Workerの作成
            worker = new Worker(
                new URL(
                    '../workers/imageCompressor.worker.ts',
                    import.meta.url
                ),
                { type: 'module' }
            );

            // Workerからのメッセージ処理
            worker.onmessage = (e) => {
                const data = e.data;

                if (data.type === 'progress') {
                    onProgress(data.stage, data.percent);
                } else if (data.type === 'result') {
                    console.log(
                        `画像圧縮完了: 品質=${data.quality}%, サイズ=${(data.size / 1024 / 1024).toFixed(2)}MB`
                    );
                    const blob = new Blob([data.data], { type: 'image/jpeg' });
                    worker.terminate();
                    resolve(blob);
                } else if (data.type === 'error') {
                    worker.terminate();
                    reject(new Error(data.message));
                }
            };

            // エラーハンドリング
            worker.onerror = (e) => {
                worker.terminate();
                reject(new Error(`Web Worker エラー: ${e.message}`));
            };

            // 処理開始
            worker.postMessage({
                type: 'compress',
                imageData: base64Image,
                resolution,
                maxSize,
            });
        } catch (error) {
            if (worker!) worker.terminate();
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
};

/**
 * メインスレッドでの画像圧縮（Photon WASM利用）
 */
const compressUsingMainThread = async (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    onProgress('画像読み込み中', 10);

    // Base64文字列から画像データ部分を取得
    const imageDataPart = base64Image.includes(',')
        ? base64Image.split(',')[1] || base64Image
        : base64Image;

    let photonImage: PhotonImage | null = null;

    try {
        // 1. 画像の読み込みとサイズの取得
        const imgElement = document.createElement('img');
        await new Promise<void>((resolve, reject) => {
            imgElement.onload = () => resolve();
            imgElement.onerror = () =>
                reject(new Error('画像の読み込みに失敗しました'));
            imgElement.src = base64Image;
        });

        const originalWidth = imgElement.naturalWidth;
        const originalHeight = imgElement.naturalHeight;

        onProgress('リサイズ処理中', 30);
        await yieldToUI();

        // 2. Photon用の画像オブジェクトを作成
        photonImage = PhotonImage.new_from_base64(imageDataPart);
        await yieldToUI();

        // 3. リサイズ処理（必要な場合のみ）
        const { width: targetWidth, height: targetHeight } =
            calculateResizedDimensions(
                originalWidth,
                originalHeight,
                resolution
            );

        // 実際のリサイズが必要な場合
        if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
            resize(
                photonImage,
                targetWidth,
                targetHeight,
                SamplingFilter.CatmullRom
            );
            await yieldToUI();
        }

        onProgress('画像圧縮中', 60);

        // 4. 画像圧縮の実行（二分探索）
        if (!photonImage) throw new Error('PhotonImageの初期化に失敗しました');

        const compressionResult = await findOptimalCompression(
            async (quality) => photonImage!.get_bytes_jpeg(quality),
            maxSize,
            (i) => onProgress(`圧縮最適化中 (${i + 1}/5)`, 60 + i * 8)
        );

        onProgress('完了', 100);

        // 5. JPEGバイトからBlobを生成
        return new Blob([new Uint8Array(compressionResult.bestData)], {
            type: 'image/jpeg',
        });
    } catch (error) {
        console.error('画像圧縮に失敗しました:', error);
        throw error instanceof Error ? error : new Error(String(error));
    } finally {
        // メモリを確実に解放
        if (photonImage) photonImage.free();
    }
};

// UIスレッドに制御を戻すヘルパー関数
const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 最適な圧縮品質を見つける二分探索関数
 */
interface CompressionResult<T> {
    bestQuality: number;
    bestData: T;
    size: number;
}

async function findOptimalCompression<
    T extends ArrayBuffer | Uint8Array | Blob,
>(
    compressFn: (quality: number) => Promise<T>,
    maxSizeBytes: number,
    onIterationProgress?: (iteration: number) => void
): Promise<CompressionResult<T>> {
    let minQuality = 20;
    let maxQuality = 90;
    let bestQuality = minQuality;
    let bestData: T | null = null;
    let bestSize = 0;

    // サイズ取得ヘルパー関数
    const getSize = (data: T): number =>
        data instanceof Blob ? data.size : data.byteLength;

    // 最初に高品質で試す
    let data = await compressFn(maxQuality);
    let size = getSize(data);

    if (size <= maxSizeBytes) {
        return { bestQuality: maxQuality, bestData: data, size };
    }

    // 二分探索で最適な品質を探す
    for (let i = 0; i < 5; i++) {
        if (onIterationProgress) onIterationProgress(i);

        const currentQuality = Math.floor((minQuality + maxQuality) / 2);
        data = await compressFn(currentQuality);
        size = getSize(data);

        if (size <= maxSizeBytes) {
            bestData = data;
            bestQuality = currentQuality;
            bestSize = size;
            minQuality = currentQuality;
        } else {
            maxQuality = currentQuality - 1;
        }

        if (maxQuality - minQuality <= 2) break;
    }

    // 適切な品質が見つからなかった場合は最低品質で圧縮
    if (!bestData) {
        bestData = await compressFn(minQuality);
        bestSize = getSize(bestData);
    }

    return { bestQuality, bestData, size: bestSize };
}

/**
 * リサイズ後のサイズを計算する共通関数
 */
function calculateResizedDimensions(
    originalWidth: number,
    originalHeight: number,
    resolution: number
): { width: number; height: number } {
    // リサイズ不要ならそのまま返す
    if (Math.max(originalWidth, originalHeight) <= resolution) {
        return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    // 幅か高さのいずれか大きい方を基準にリサイズ
    return originalWidth > originalHeight
        ? { width: resolution, height: Math.round(resolution / aspectRatio) }
        : { height: resolution, width: Math.round(resolution * aspectRatio) };
}

// ファイル → Base64変換ヘルパー
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () =>
            reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
    });
};

// Blob → Base64変換ヘルパー
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => reject(new Error('Blobの変換に失敗しました'));
        reader.readAsDataURL(blob);
    });
};

export const useGetImage = (
    name: string | null | undefined,
    options?: { prefix: string }
): string => {
    if (!name?.length) return '';

    const img = name
        .split('/')
        .map((p) => encodeURIComponent(p))
        .join('/');

    const runtime = useRuntimeConfig();
    const prefix = options?.prefix ? `/${options.prefix}` : '';

    return `${runtime.public.r2.domain}${prefix}/${img}`;
};

export const usePutImage = async (
    file: File,
    options: { resolution: number; size: number; target: 'setup' | 'avatar' }
) => {
    try {
        // 画像処理
        let imageBlob: Blob;

        if (file.type.startsWith('image/')) {
            // 画像ファイルの場合は圧縮処理
            const base64Image = await fileToBase64(file);
            imageBlob = await useCompressImage(
                base64Image,
                options.resolution,
                {
                    maxSize: options.size,
                }
            );
        } else {
            // 画像でない場合はそのまま
            imageBlob = file;
        }

        // APIに送信
        const base64ForAPI = await blobToBase64(imageBlob);
        const response = await $fetch('/api/image', {
            method: 'PUT',
            body: {
                image: base64ForAPI,
                target: options.target,
            },
        });

        return {
            name: response.path,
            target: response.target,
            width: response.width,
            height: response.height,
        };
    } catch (error) {
        console.error('Failed to upload image:', error);
        return null;
    }
};

export const useDeleteImage = (name: string, options?: { target?: string }) => {
    return $fetch('/api/image', {
        method: 'DELETE',
        query: { name, target: options?.target },
    });
};
