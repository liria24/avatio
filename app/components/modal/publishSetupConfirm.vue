<script lang="ts" setup>
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const vis = defineModel<boolean>({ default: false });

// インターフェース定義
interface Props {
    // Blobも受け付けるように型を変更
    imageSrc: string | Blob | null;
}

interface CropInfo {
    positionX: number;
    positionY: number;
    width: number;
}

interface Coordinates {
    width: number;
    height: number;
    left: number;
    top: number;
}

interface ImageSize {
    width: number;
    height: number;
}

// Props
const props = defineProps<Props>();

// 出力用のイベント
const emit = defineEmits<{
    change: [CropInfo];
}>();

// 座標情報の状態
const cropInfo = ref<CropInfo>({
    positionX: 0,
    positionY: 0,
    width: 0,
});

// cropperへの参照
const cropperRef = ref();

// Blobから生成したURL
const blobUrl = ref<string | null>(null);

// 画像サイズ情報
const imageSize = ref<ImageSize | null>(null);

// Cropperコンポーネントに渡す実際のソースURL
const sourceUrl = computed(() => {
    if (blobUrl.value) return blobUrl.value;
    return typeof props.imageSrc === 'string' ? props.imageSrc : null;
});

// BlobからURLを生成する関数
const createBlobUrl = (blob: Blob) => {
    // 既存のURLがあれば解放
    if (blobUrl.value) {
        URL.revokeObjectURL(blobUrl.value);
    }
    blobUrl.value = URL.createObjectURL(blob);
};

// propsの変更を監視
watch(
    () => props.imageSrc,
    (newValue) => {
        if (newValue instanceof Blob) {
            createBlobUrl(newValue);
        } else {
            // Blobでない場合はblobUrlをクリア
            if (blobUrl.value) {
                URL.revokeObjectURL(blobUrl.value);
                blobUrl.value = null;
            }
        }
        // 画像が変わったらサイズ情報をリセット
        imageSize.value = null;
    },
    { immediate: true }
);

// コンポーネントのクリーンアップ
onBeforeUnmount(() => {
    if (blobUrl.value) {
        URL.revokeObjectURL(blobUrl.value);
        blobUrl.value = null;
    }
});

/**
 * クロップ領域の位置情報を計算する
 * positionX/Yは領域の左/上端が0%、右/下端が100%となるようにする
 */
const calculatePositionInfo = (
    coordinates: Coordinates,
    image: ImageSize
): CropInfo | null => {
    if (!coordinates || !image) {
        console.error('Invalid coordinates or image data');
        return null;
    }

    try {
        // 画像全体に対するクロップ領域の幅の割合（％）
        const width = (coordinates.width / image.width) * 100;

        // 最大オフセットを計算（クロップ可能な範囲）
        const maxOffsetX = image.width - coordinates.width;
        const maxOffsetY = image.height - coordinates.height;

        // エッジケース処理（クロップ領域が画像全体と同じ大きさの場合）
        const positionX =
            maxOffsetX <= 0 ? 0 : (coordinates.left / maxOffsetX) * 100;
        const positionY =
            maxOffsetY <= 0 ? 0 : (coordinates.top / maxOffsetY) * 100;

        // 範囲内に収める（0〜100%）
        return {
            positionX: Math.max(0, Math.min(100, positionX)),
            positionY: Math.max(0, Math.min(100, positionY)),
            width,
        };
    } catch (error) {
        console.error('Error calculating position info:', error);
        return null;
    }
};

// 画像の読み込み完了時のハンドラー
const onReady = (event: { width: number; height: number }) => {
    try {
        imageSize.value = {
            width: event.width,
            height: event.height,
        };
    } catch (error) {
        console.error('Error handling image ready event:', error);
    }
};

// 変更イベントのハンドラー
const onChange = (event: { coordinates: Coordinates; image: ImageSize }) => {
    try {
        const { coordinates, image } = event;

        if (!coordinates || !image) {
            console.error(
                'Cropper coordinates or image information is missing'
            );
            return;
        }

        const positionInfo = calculatePositionInfo(coordinates, image);
        if (!positionInfo) return;

        // 状態を更新し、変更を親に通知
        cropInfo.value = positionInfo;
        emit('change', cropInfo.value);
    } catch (error) {
        console.error('Error processing crop information:', error);
    }
};

// 結果を手動で取得するメソッド
const getCropInfo = (): CropInfo | null => {
    try {
        if (!cropperRef.value) {
            console.error('Cropper reference is not available');
            return null;
        }

        const { coordinates, image } = cropperRef.value.getResult();
        return calculatePositionInfo(coordinates, image);
    } catch (error) {
        console.error('Error getting crop information:', error);
        return null;
    }
};

defineExpose({
    getCropInfo,
});
</script>

<template>
    <Modal v-model="vis">
        <Cropper
            ref="cropperRef"
            :src="sourceUrl"
            :stencil-props="{ aspectRatio: 1.91 }"
            :default-size="
                // @ts-ignore
                ({ imageSize }) => {
                    return {
                        width: imageSize.width,
                        height: imageSize.height,
                    };
                }
            "
            image-restriction="stencil"
            @change="onChange"
            @ready="onReady"
            @error="(err) => console.error('Cropper error:', err)"
        />

        <div class="p-3 rounded-lg text-sm">
            <p>Position X: {{ cropInfo.positionX.toFixed(2) }}%</p>
            <p>Position Y: {{ cropInfo.positionY.toFixed(2) }}%</p>
            <p>Width: {{ cropInfo.width.toFixed(2) }}%</p>
        </div>
    </Modal>
</template>
