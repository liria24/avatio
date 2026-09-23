import type { Ref } from 'vue'

export interface SetupImageUpload {
    id: string
    file: File
    status: 'queued' | 'uploading' | 'failed'
    cancelled: boolean
}

export const useSetupComposeImages = (
    images: Readonly<Ref<string[]>>,
    setImages: (images: string[]) => void,
    metadata: Ref<Record<string, SetupImageMetadata>>,
) => {
    const toast = useToast()
    const { t } = useI18n()
    const uploads = ref<SetupImageUpload[]>([])
    const imageUploading = computed(() =>
        uploads.value.some(({ status }) => status === 'queued' || status === 'uploading'),
    )
    const uploadOrder: string[] = []
    const completedUploads = new Map<string, string>()
    let queue = Promise.resolve()

    const insertCompletedUpload = (id: string, url: string) => {
        completedUploads.set(id, url)
        const order = uploadOrder.indexOf(id)
        const previous = uploadOrder
            .slice(0, order)
            .reverse()
            .map((candidate) => completedUploads.get(candidate))
            .find((candidate) => candidate && images.value.includes(candidate))
        const next = uploadOrder
            .slice(order + 1)
            .map((candidate) => completedUploads.get(candidate))
            .find((candidate) => candidate && images.value.includes(candidate))
        const index = previous
            ? images.value.indexOf(previous) + 1
            : next
              ? images.value.indexOf(next)
              : images.value.length
        setImages([...images.value.slice(0, index), url, ...images.value.slice(index)])
    }

    const getImageId = (url: string) => metadata.value[url]?.id ?? url
    const getSelectedImageMetadata = () => {
        const entries = images.value
            .map((url) => {
                const value = metadata.value[url]
                return value ? ([url, value] as const) : null
            })
            .filter((entry): entry is readonly [string, SetupImageMetadata] => entry !== null)
        return entries.length ? Object.fromEntries(entries) : undefined
    }

    const runUpload = async (upload: SetupImageUpload) => {
        if (upload.cancelled) return
        upload.status = 'uploading'
        try {
            const image = await uploadImage(upload.file, 'setup')
            if (upload.cancelled) return
            metadata.value = {
                ...metadata.value,
                [image.url]: {
                    id: upload.id,
                    objectKey: image.objectKey,
                    contentType: image.contentType,
                    size: image.size,
                    etag: image.etag,
                    width: image.width,
                    height: image.height,
                    themeColors: image.themeColors.length ? image.themeColors : null,
                },
            }
            insertCompletedUpload(upload.id, image.url)
            uploads.value = uploads.value.filter(({ id }) => id !== upload.id)
        } catch (error) {
            if (upload.cancelled) return
            upload.status = 'failed'
            console.error('Error uploading image:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('errors.imageUploadFailed'),
                color: 'error',
            })
        }
    }

    const enqueue = (upload: SetupImageUpload) => {
        queue = queue.then(() => runUpload(upload))
    }

    const processImages = (files: FileList | File[] | null) => {
        const remaining = 4 - images.value.length - uploads.value.length
        for (const file of Array.from(files ?? []).slice(0, Math.max(remaining, 0))) {
            const upload: SetupImageUpload = {
                id: crypto.randomUUID(),
                file,
                status: 'queued',
                cancelled: false,
            }
            uploads.value.push(upload)
            uploadOrder.push(upload.id)
            enqueue(upload)
        }
    }

    const cancelUpload = (id: string) => {
        const upload = uploads.value.find((candidate) => candidate.id === id)
        if (upload) upload.cancelled = true
        uploads.value = uploads.value.filter((candidate) => candidate.id !== id)
        const order = uploadOrder.indexOf(id)
        if (order >= 0) uploadOrder.splice(order, 1)
    }

    const retryUpload = (id: string) => {
        const upload = uploads.value.find((candidate) => candidate.id === id)
        if (!upload || upload.status !== 'failed') return
        upload.status = 'queued'
        enqueue(upload)
    }

    const cancelAllUploads = () => {
        for (const upload of uploads.value) upload.cancelled = true
        uploads.value = []
        uploadOrder.length = 0
        completedUploads.clear()
    }

    const removeImage = (index: number) => {
        const removed = images.value[index]
        if (!removed) return
        const nextMetadata = { ...metadata.value }
        const uploadId = nextMetadata[removed]?.id
        if (uploadId && completedUploads.has(uploadId)) {
            completedUploads.delete(uploadId)
            const order = uploadOrder.indexOf(uploadId)
            if (order >= 0) uploadOrder.splice(order, 1)
        }
        Reflect.deleteProperty(nextMetadata, removed)
        metadata.value = nextMetadata
        setImages(images.value.filter((_, imageIndex) => imageIndex !== index))
    }

    const reorderImages = (next: string[]) => setImages(next)

    return {
        getImageId,
        getSelectedImageMetadata,
        uploads,
        imageUploading,
        processImages,
        cancelUpload,
        cancelAllUploads,
        retryUpload,
        removeImage,
        reorderImages,
    }
}
