<script lang="ts" setup>
import { cn } from 'cn'

const {
    values,
    uploads,
    getImageId,
    openImagePoints,
    processImages,
    cancelUpload,
    retryUpload,
    removeImage,
    reorderImages,
} = useSetupCompose()

const dropZoneRef = ref<HTMLDivElement>()
const imageCount = computed(() => values.value.images.length + uploads.value.length)
const pointCount = (url: string) =>
    values.value.points.filter(({ imageId }) => imageId === getImageId(url)).length

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: processImages,
    dataTypes: ['image/jpg', 'image/jpeg', 'image/png', 'image/webp'],
    multiple: true,
    preventDefaultForUnhandled: true,
})

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp',
    multiple: true,
    directory: false,
})

onChange((files) => {
    processImages(files)
    reset()
})
</script>

<template>
    <UFormField :label="$t('setup.compose.images.title')" :help="`${imageCount} / 4`">
        <div ref="dropZoneRef" class="flex flex-wrap items-start gap-3">
            <SortableList
                v-if="values.images.length"
                :model-value="values.images"
                handle=".image-drag"
                class="contents"
                @update:model-value="reorderImages"
            >
                <div
                    v-for="(image, index) in values.images"
                    :key="getImageId(image)"
                    class="group flex flex-col gap-1"
                >
                    <div class="relative size-32">
                        <button
                            type="button"
                            :aria-label="$t('setup.compose.points.title')"
                            class="image-drag relative size-full cursor-move overflow-clip rounded-lg select-none"
                            @click="openImagePoints(image)"
                        >
                            <NuxtImg
                                :src="image"
                                :alt="`Setup image ${index + 1}`"
                                width="256"
                                height="256"
                                class="size-full object-cover"
                            />
                            <span
                                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/30 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-black/30"
                            >
                                <Icon
                                    name="mingcute:dots-line"
                                    size="24"
                                    class="text-highlighted"
                                />
                            </span>
                            <span
                                class="ring-inverted/15 pointer-events-none absolute inset-0 rounded-lg ring-2"
                            />
                        </button>
                        <UButton
                            :aria-label="$t('setup.compose.images.remove')"
                            icon="mingcute:close-line"
                            variant="ghost"
                            size="xs"
                            :ui="{ leadingIcon: 'text-highlighted' }"
                            class="absolute top-1.5 right-1.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            @click.stop="removeImage(index)"
                        />
                    </div>

                    <UButton
                        :label="String(pointCount(image))"
                        :aria-label="$t('setup.compose.points.title')"
                        icon="mingcute:map-pin-fill"
                        variant="soft"
                        size="xs"
                        :ui="{ leadingIcon: 'size-3.5' }"
                        :class="
                            cn(
                                'ml-auto rounded-full px-3',
                                pointCount(image) === 0 &&
                                    'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                            )
                        "
                        @click="openImagePoints(image)"
                    />
                </div>
            </SortableList>

            <div v-for="upload in uploads" :key="upload.id" class="group flex flex-col gap-1">
                <div
                    class="bg-muted/40 ring-muted grid size-32 place-items-center rounded-lg ring-1"
                >
                    <Icon
                        :name="
                            upload.status === 'failed'
                                ? 'mingcute:warning-fill'
                                : 'svg-spinners:ring-resize'
                        "
                        size="24"
                        :class="upload.status === 'failed' ? 'text-error' : 'text-muted'"
                    />
                    <span class="text-muted max-w-24 truncate text-xs">{{ upload.file.name }}</span>
                </div>
                <div class="flex justify-end gap-1">
                    <UButton
                        v-if="upload.status === 'failed'"
                        :aria-label="$t('setup.compose.images.retry')"
                        icon="mingcute:refresh-2-fill"
                        variant="ghost"
                        size="xs"
                        @click="retryUpload(upload.id)"
                    />
                    <UButton
                        :aria-label="$t('cancel')"
                        icon="mingcute:close-line"
                        variant="ghost"
                        size="xs"
                        @click="cancelUpload(upload.id)"
                    />
                </div>
            </div>

            <UButton
                v-if="imageCount < 4"
                :aria-label="$t('setup.compose.images.add')"
                :icon="isOverDropZone ? 'mingcute:download-fill' : 'mingcute:add-line'"
                variant="soft"
                active-color="neutral"
                active-variant="subtle"
                :active="isOverDropZone"
                :ui="{ leadingIcon: 'm-auto size-6' }"
                class="size-32 rounded-lg"
                @click="open()"
            />
        </div>
    </UFormField>
</template>
