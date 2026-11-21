<script setup lang="ts">
import { cn } from 'cn'

const props = defineProps<{
    images: NonNullable<Serialized<Setup>['images']>
    points: SetupPoint[]
    entries: SetupEntryView[]
    name: string
}>()

const emit = defineEmits<{
    selectEntry: [entryId: string]
}>()

const carousel = ref<{ emblaApi?: { scrollTo: (index: number) => void } }>()
const selectedIndex = ref(0)
const expanded = ref(false)
const highlightedPointId = ref<string>()
const imageViewer = useImageViewerModal()
const entryById = computed(() => new Map(props.entries.map((entry) => [entry.id, entry])))
const visiblePoints = computed(() =>
    props.points.filter(
        (point) =>
            entryById.value.get(point.entryId)?.catalogItem.primarySource?.availability ===
            'available',
    ),
)

const imagePoints = (imageId: string) =>
    visiblePoints.value.filter((point) => point.imageId === imageId)

const selectPoint = (point: SetupPoint) => {
    highlightedPointId.value = point.id
    emit('selectEntry', point.entryId)
}

const showEntry = (entryId: string) => {
    const point = visiblePoints.value.find((candidate) => candidate.entryId === entryId)
    if (!point) return
    const imageIndex = props.images.findIndex(({ id }) => id === point.imageId)
    if (imageIndex < 0) return
    selectedIndex.value = imageIndex
    highlightedPointId.value = point.id
    carousel.value?.emblaApi?.scrollTo(imageIndex)
}

defineExpose({ showEntry })
</script>

<template>
    <section v-if="images.length" class="flex w-full flex-col gap-3">
        <UCarousel
            ref="carousel"
            :items="images"
            :arrows="images.length > 1"
            :ui="{
                item: 'basis-full px-10 py-2',
                prev: 'absolute left-1 top-1/2 -translate-y-1/2 z-20',
                next: 'absolute right-1 top-1/2 -translate-y-1/2 z-20',
            }"
            @select="selectedIndex = $event"
        >
            <template #default="{ item: image, index }">
                <div class="relative mx-auto w-fit max-w-full">
                    <button
                        type="button"
                        :aria-label="$t('imageViewer.open', { name, index: index + 1 })"
                        aria-haspopup="dialog"
                        class="block max-w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
                        @click="
                            imageViewer.open({
                                src: image.url,
                                alt: `${name}${$t('setup.viewer.imageAlt')}`,
                            })
                        "
                    >
                        <NuxtImg
                            :src="image.url"
                            :width="
                                image.height > 720
                                    ? Math.round((image.width * 720) / image.height)
                                    : image.width
                            "
                            :height="Math.min(image.height, 720)"
                            format="avif"
                            :preload="index === 0"
                            :loading="index === 0 ? 'eager' : 'lazy'"
                            :fetchpriority="index === 0 ? 'high' : 'low'"
                            :alt="`${name}${$t('setup.viewer.imageAlt')}`"
                            class="max-h-180 max-w-full cursor-zoom-in rounded-lg object-contain"
                        />
                    </button>

                    <SetupsViewerItemPoints
                        v-if="imagePoints(image.id).length"
                        :points="imagePoints(image.id)"
                        :entry-by-id="entryById"
                        :expanded="expanded"
                        :highlighted-point-id="highlightedPointId"
                        @select="selectPoint"
                    />
                </div>
            </template>
        </UCarousel>

        <div class="flex flex-wrap items-center justify-center gap-2">
            <UButton
                v-if="visiblePoints.length"
                :label="
                    expanded ? $t('setup.viewer.collapsePoints') : $t('setup.viewer.expandPoints')
                "
                :icon="expanded ? 'mingcute:close-line' : 'mingcute:map-pin-fill'"
                variant="soft"
                size="sm"
                @click="expanded = !expanded"
            />
            <button
                v-for="(image, index) in images"
                :key="image.id"
                type="button"
                :aria-label="`${name} ${index + 1}`"
                :aria-current="selectedIndex === index ? 'true' : undefined"
                :class="
                    cn(
                        'overflow-hidden rounded-md ring-2 transition-opacity',
                        selectedIndex === index ? 'ring-primary' : 'opacity-60 ring-transparent',
                    )
                "
                @click="carousel?.emblaApi?.scrollTo(index)"
            >
                <NuxtImg
                    :src="image.url"
                    alt=""
                    width="64"
                    height="64"
                    class="size-12 object-cover"
                />
            </button>
        </div>
    </section>
</template>
