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
                        @click="imageViewer.open({ src: image.url, alt: name })"
                    />

                    <svg
                        v-if="expanded"
                        class="pointer-events-none absolute inset-0 size-full overflow-visible"
                        aria-hidden="true"
                    >
                        <line
                            v-for="(point, pointIndex) in imagePoints(image.id)"
                            :key="`line-${point.id}`"
                            :x1="`${point.x * 100}%`"
                            :y1="`${point.y * 100}%`"
                            :x2="`${setupExpandedPointPosition(pointIndex, imagePoints(image.id).length).x * 100}%`"
                            :y2="`${setupExpandedPointPosition(pointIndex, imagePoints(image.id).length).y * 100}%`"
                            class="stroke-primary"
                            stroke-width="2"
                        />
                    </svg>

                    <button
                        v-for="point in imagePoints(image.id)"
                        :key="point.id"
                        type="button"
                        :style="setupPointStyle(point)"
                        :aria-label="
                            entryById.get(point.entryId)?.catalogItem.name ?? point.entryId
                        "
                        :class="
                            cn(
                                'ring-default absolute z-10 -translate-1/2 overflow-hidden rounded-full shadow-lg ring-2 transition-transform',
                                expanded ? 'bg-primary size-3' : 'size-9 bg-white',
                                highlightedPointId === point.id && 'ring-primary scale-125',
                            )
                        "
                        @click.stop="selectPoint(point)"
                    >
                        <NuxtImg
                            v-if="!expanded && entryById.get(point.entryId)?.catalogItem.image"
                            :src="entryById.get(point.entryId)?.catalogItem.image || undefined"
                            alt=""
                            width="40"
                            height="40"
                            class="size-full object-cover"
                        />
                        <Icon v-else-if="!expanded" name="mingcute:package-2-fill" size="18" />
                    </button>

                    <button
                        v-for="(point, pointIndex) in expanded ? imagePoints(image.id) : []"
                        :key="`expanded-${point.id}`"
                        type="button"
                        :style="
                            setupPointStyle(
                                setupExpandedPointPosition(
                                    pointIndex,
                                    imagePoints(image.id).length,
                                ),
                            )
                        "
                        :aria-label="
                            entryById.get(point.entryId)?.catalogItem.name ?? point.entryId
                        "
                        class="ring-default absolute z-10 size-16 -translate-1/2 overflow-hidden rounded-xl bg-white shadow-xl ring-2"
                        @click.stop="selectPoint(point)"
                    >
                        <NuxtImg
                            v-if="entryById.get(point.entryId)?.catalogItem.image"
                            :src="entryById.get(point.entryId)?.catalogItem.image || undefined"
                            alt=""
                            width="72"
                            height="72"
                            class="size-full object-cover"
                        />
                        <Icon v-else name="mingcute:package-2-fill" size="28" />
                    </button>
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
