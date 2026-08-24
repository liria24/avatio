import type { Ref, WritableComputedRef } from 'vue'

export const useSetupComposeImages = (
    images: WritableComputedRef<string[]>,
    metadata: Ref<Record<string, SetupImageMetadata>>,
    uploading: Ref<boolean>,
) => {
    const toast = useToast()
    const { t } = useI18n()

    const getSelectedImageMetadata = () => {
        const entries = images.value
            .map((url) => {
                const value = metadata.value[url]
                return value ? ([url, value] as const) : null
            })
            .filter((entry): entry is readonly [string, SetupImageMetadata] => entry !== null)
        return entries.length ? Object.fromEntries(entries) : undefined
    }

    const processImages = async (files: FileList | File[] | null) => {
        const file = files?.[0]
        if (!file) return

        uploading.value = true
        try {
            const image = await uploadImage(file, 'setup')
            images.value.push(image.url)
            metadata.value[image.url] = {
                objectKey: image.objectKey,
                contentType: image.contentType,
                size: image.size,
                etag: image.etag,
                width: image.width,
                height: image.height,
                themeColors: image.themeColors.length ? image.themeColors : null,
            }
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('errors.imageUploadFailed'),
                color: 'error',
            })
        } finally {
            uploading.value = false
        }
    }

    const removeImage = (index: number) => {
        const [removed] =
            index >= 0 && index < images.value.length ? images.value.splice(index, 1) : []
        if (!removed) return
        const nextMetadata = { ...metadata.value }
        Reflect.deleteProperty(nextMetadata, removed)
        metadata.value = nextMetadata
    }

    return { getSelectedImageMetadata, processImages, removeImage }
}
