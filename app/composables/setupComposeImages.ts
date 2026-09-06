import type { Ref } from 'vue'

export const useSetupComposeImages = (
    images: Readonly<Ref<string[]>>,
    setImages: (images: string[]) => void,
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
            metadata.value[image.url] = {
                objectKey: image.objectKey,
                contentType: image.contentType,
                size: image.size,
                etag: image.etag,
                width: image.width,
                height: image.height,
                themeColors: image.themeColors.length ? image.themeColors : null,
            }
            setImages([...images.value, image.url])
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
        const removed = images.value[index]
        if (!removed) return
        const nextMetadata = { ...metadata.value }
        Reflect.deleteProperty(nextMetadata, removed)
        metadata.value = nextMetadata
        setImages(images.value.filter((_, imageIndex) => imageIndex !== index))
    }

    return { getSelectedImageMetadata, processImages, removeImage }
}
