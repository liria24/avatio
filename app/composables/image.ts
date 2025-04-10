import { PhotonImage, resize, SamplingFilter } from '@silvia-odwyer/photon';

// 画像圧縮のメイン関数
export const useCompressImage = async (
    base64Image: string,
    resolution: number,
    options?: {
        maxSize?: number;
        onProgress?: (stage: string, percent: number) => void;
    }
): Promise<Blob> => {
    const maxSize = options?.maxSize || 1.5 * 1024 * 1024;
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
    }

    console.warn('Web Worker非対応環境: メインスレッドで処理します');
    return compressUsingMainThread(
        base64Image,
        resolution,
        maxSize,
        onProgress
    );
};

// Web Worker環境での画像圧縮
const compressUsingWebWorker = (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        let worker: Worker;

        try {
            worker = new Worker(
                new URL(
                    '../workers/imageCompressor.worker.ts',
                    import.meta.url
                ),
                { type: 'module' }
            );

            worker.onmessage = ({ data }) => {
                if (data.type === 'progress') {
                    onProgress(data.stage, data.percent);
                } else if (data.type === 'result') {
                    const blob = new Blob([data.data], { type: 'image/jpeg' });
                    worker.terminate();
                    resolve(blob);
                } else if (data.type === 'error') {
                    worker.terminate();
                    reject(new Error(data.message));
                }
            };

            worker.onerror = (e) => {
                worker.terminate();
                reject(new Error(`Worker エラー: ${e.message}`));
            };

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

// メインスレッドでの画像圧縮
const compressUsingMainThread = async (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    onProgress('画像読み込み中', 10);

    const imageData = base64Image.includes(',')
        ? base64Image.split(',')[1] || base64Image
        : base64Image;

    let photonImage: PhotonImage | null = null;

    try {
        // 画像読み込み
        const img = document.createElement('img');
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('画像読み込み失敗'));
            img.src = base64Image;
        });

        onProgress('リサイズ処理中', 30);
        await yieldToUI();

        // Photon処理
        photonImage = PhotonImage.new_from_base64(imageData);
        await yieldToUI();

        // リサイズ処理
        const { width, height } = calcResize(
            img.naturalWidth,
            img.naturalHeight,
            resolution
        );

        if (width !== img.naturalWidth || height !== img.naturalHeight) {
            resize(photonImage, width, height, SamplingFilter.CatmullRom);
            await yieldToUI();
        }

        onProgress('画像圧縮中', 60);

        // 圧縮実行
        if (!photonImage) throw new Error('PhotonImage初期化失敗');

        const result = await optimizeCompression(
            (quality: number) =>
                Promise.resolve(photonImage!.get_bytes_jpeg(quality)),
            maxSize,
            (i) => onProgress(`圧縮最適化中 (${i + 1}/5)`, 60 + i * 8)
        );

        onProgress('完了', 100);

        return new Blob([new Uint8Array(result.bestData)], {
            type: 'image/jpeg',
        });
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
    } finally {
        if (photonImage) photonImage.free();
    }
};

// UIスレッドに制御を戻す
const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));

// 最適な圧縮品質を探す
async function optimizeCompression<T extends ArrayBuffer | Uint8Array | Blob>(
    compress: (quality: number) => Promise<T>,
    maxSize: number,
    onProgress?: (i: number) => void
) {
    let min = 20,
        max = 90;
    let bestQuality = min;
    let bestData: T | null = null;
    let bestSize = 0;

    const getSize = (data: T) =>
        data instanceof Blob ? data.size : data.byteLength;

    // 高品質で試行
    let data = await compress(max);
    let size = getSize(data);

    if (size <= maxSize) return { bestQuality: max, bestData: data, size };

    // 二分探索
    for (let i = 0; i < 5; i++) {
        if (onProgress) onProgress(i);

        const quality = Math.floor((min + max) / 2);
        data = await compress(quality);
        size = getSize(data);

        if (size <= maxSize) {
            bestData = data;
            bestQuality = quality;
            bestSize = size;
            min = quality;
        } else max = quality - 1;

        if (max - min <= 2) break;
    }

    // 最低品質でフォールバック
    if (!bestData) {
        bestData = await compress(min);
        bestSize = getSize(bestData);
    }

    return { bestQuality, bestData, size: bestSize };
}

// リサイズ計算
function calcResize(width: number, height: number, resolution: number) {
    if (Math.max(width, height) <= resolution) return { width, height };

    const ratio = width / height;
    return width > height
        ? { width: resolution, height: Math.round(resolution / ratio) }
        : { height: resolution, width: Math.round(resolution * ratio) };
}

export const useGetImage = (
    name?: string | null,
    options?: { prefix: string }
): string => {
    if (!name?.length) return '';

    const img = name.split('/').map(encodeURIComponent).join('/');
    const config = useRuntimeConfig();
    const prefix = options?.prefix ? `/${options.prefix}` : '';

    return `${config.public.r2.domain}${prefix}/${img}`;
};

export const useDeleteImage = (name: string, options?: { target?: string }) => {
    return $fetch('/api/image', {
        method: 'DELETE',
        query: { name, target: options?.target },
    });
};
