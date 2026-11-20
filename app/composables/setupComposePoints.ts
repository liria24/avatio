import { shallowRef, type Ref } from 'vue'

import { copySetupPoints } from '#shared/utils/setupPoints'

import type { SetupImageMetadata, SetupPoint } from '../../shared/types/database'

interface SetupPointEditorState {
    id: string
    url: string
    width?: number
    height?: number
    placingEntryId?: string
}

interface SetupComposePointsOptions {
    images: Readonly<Ref<string[]>>
    points: Readonly<Ref<SetupPoint[]>>
    setPoints: (points: SetupPoint[]) => void
    imageMetadata: Readonly<Ref<Record<string, SetupImageMetadata>>>
    getImageId: (url: string) => string
    isBusy: () => boolean
}

export const useSetupComposePoints = ({
    images,
    points,
    setPoints,
    imageMetadata,
    getImageId,
    isBusy,
}: SetupComposePointsOptions) => {
    const pointEditor = shallowRef<SetupPointEditorState>()

    const closeImagePoints = () => {
        pointEditor.value = undefined
    }

    const openImagePoints = (url: string, placingEntryId?: string) => {
        if (!images.value.includes(url) || isBusy()) return
        const metadata = imageMetadata.value[url]
        pointEditor.value = {
            id: getImageId(url),
            url,
            width: metadata?.width,
            height: metadata?.height,
            placingEntryId,
        }
    }

    const updateImagePoints = (imageId: string, nextPoints: SetupPoint[]) => {
        if (pointEditor.value?.id !== imageId || isBusy()) return
        const other = points.value.filter((point) => point.imageId !== imageId)
        if (other.length + nextPoints.length > 128) return
        setPoints([...other, ...copySetupPoints(nextPoints)])
    }

    const removeEntryPoints = (entryId: string) => {
        closeImagePoints()
        setPoints(points.value.filter((point) => point.entryId !== entryId))
    }

    const removeImagePoints = (url?: string) => {
        closeImagePoints()
        if (url) setPoints(points.value.filter((point) => point.imageId !== getImageId(url)))
    }

    return {
        pointEditor,
        closeImagePoints,
        openImagePoints,
        updateImagePoints,
        removeEntryPoints,
        removeImagePoints,
    }
}
