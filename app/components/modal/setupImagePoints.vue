<script setup lang="ts">
interface PointItem {
    id: string
    name: string
    image: string | null
}

const props = defineProps<{
    imageUrl: string
    imageId: string
    entries: PointItem[]
    points: SetupPoint[]
    placingEntryId?: string
    onUpdate: (points: SetupPoint[]) => void
}>()

const points = ref(structuredClone(props.points))
const pickerOpen = ref(false)
const movingPointId = ref<string>()
const pending = ref<{ x: number; y: number; pointId?: string }>()
const entryFor = (entryId: string) => props.entries.find(({ id }) => id === entryId)

const openPicker = async (point: { x: number; y: number; pointId?: string }) => {
    pickerOpen.value = false
    pending.value = point
    await nextTick()
    pickerOpen.value = true
}

const onImageClick = (event: MouseEvent) => {
    const point = normalizeSetupPoint(
        event.clientX,
        event.clientY,
        (event.currentTarget as HTMLImageElement).getBoundingClientRect(),
    )
    if (movingPointId.value) {
        const id = movingPointId.value
        update(
            points.value.map((candidate) =>
                candidate.id === id ? { ...candidate, ...point } : candidate,
            ),
        )
        movingPointId.value = undefined
        return
    }
    if (props.placingEntryId) {
        pending.value = point
        chooseItem(props.placingEntryId)
        return
    }
    void openPicker(point)
}

const update = (next: SetupPoint[]) => {
    points.value = next
    props.onUpdate(structuredClone(next))
}

const chooseItem = (entryId: string) => {
    if (!pending.value) return
    const id = pending.value.pointId ?? crypto.randomUUID()
    update([
        ...points.value.filter((point) => point.id !== id),
        {
            id,
            imageId: props.imageId,
            entryId,
            x: pending.value.x,
            y: pending.value.y,
        },
    ])
    pickerOpen.value = false
    pending.value = undefined
}

const movePoint = () => {
    movingPointId.value = pending.value?.pointId
    pickerOpen.value = false
    pending.value = undefined
}

const deletePoint = () => {
    if (pending.value?.pointId)
        update(points.value.filter(({ id }) => id !== pending.value?.pointId))
    pickerOpen.value = false
    pending.value = undefined
}
</script>

<template>
    <UModal
        :title="$t('setup.compose.points.title')"
        :description="$t('setup.compose.points.description')"
        :ui="{ content: 'sm:max-w-6xl' }"
    >
        <template #body>
            <div class="flex min-h-[65vh] flex-col gap-3">
                <UAlert
                    v-if="movingPointId"
                    icon="mingcute:move-fill"
                    :title="$t('setup.compose.points.clickToMove')"
                    variant="soft"
                    :actions="[
                        {
                            label: $t('cancel'),
                            variant: 'ghost',
                            onClick: () => (movingPointId = undefined),
                        },
                    ]"
                />

                <div
                    class="bg-muted/30 relative m-auto flex max-h-[70vh] w-fit max-w-full rounded-xl"
                >
                    <img
                        :src="imageUrl"
                        :alt="$t('setup.compose.images.preview')"
                        class="max-h-[70vh] max-w-full cursor-crosshair rounded-xl object-contain"
                        @click="onImageClick"
                    />

                    <button
                        v-for="point in points"
                        :key="point.id"
                        type="button"
                        :style="setupPointStyle(point)"
                        :aria-label="entryFor(point.entryId)?.name ?? point.entryId"
                        class="ring-default absolute size-9 -translate-1/2 overflow-hidden rounded-full bg-white shadow-lg ring-2"
                        @click.stop="openPicker({ x: point.x, y: point.y, pointId: point.id })"
                    >
                        <NuxtImg
                            v-if="entryFor(point.entryId)?.image"
                            :src="entryFor(point.entryId)?.image || undefined"
                            :alt="entryFor(point.entryId)?.name"
                            width="40"
                            height="40"
                            class="size-full object-cover"
                        />
                        <Icon v-else name="mingcute:package-2-fill" size="18" />
                    </button>

                    <UPopover
                        v-if="pending"
                        v-model:open="pickerOpen"
                        :dismissible="false"
                        :content="{ side: 'right', align: 'center' }"
                    >
                        <button
                            type="button"
                            :style="setupPointStyle(pending)"
                            class="bg-primary ring-default absolute size-3 -translate-1/2 rounded-full shadow ring-2"
                            :aria-label="$t('setup.compose.points.selectItem')"
                        />

                        <template #content>
                            <div class="flex max-h-80 w-80 flex-col gap-1 overflow-y-auto p-2">
                                <p class="text-muted px-2 py-1 text-xs">
                                    {{ $t('setup.compose.points.selectItem') }}
                                </p>
                                <UButton
                                    v-for="entry in entries"
                                    :key="entry.id"
                                    :label="entry.name"
                                    variant="ghost"
                                    class="justify-start"
                                    @click="chooseItem(entry.id)"
                                >
                                    <template #leading>
                                        <UAvatar
                                            :src="entry.image || undefined"
                                            icon="mingcute:package-2-fill"
                                            size="sm"
                                            class="rounded-md"
                                        />
                                    </template>
                                </UButton>
                                <USeparator v-if="pending.pointId" />
                                <div v-if="pending.pointId" class="flex gap-1">
                                    <UButton
                                        :label="$t('setup.compose.points.move')"
                                        icon="mingcute:move-fill"
                                        variant="soft"
                                        block
                                        @click="movePoint"
                                    />
                                    <UButton
                                        :label="$t('setup.compose.points.remove')"
                                        icon="mingcute:delete-2-fill"
                                        color="error"
                                        variant="soft"
                                        block
                                        @click="deletePoint"
                                    />
                                </div>
                                <UButton
                                    :label="$t('cancel')"
                                    variant="ghost"
                                    block
                                    @click="pickerOpen = false"
                                />
                            </div>
                        </template>
                    </UPopover>
                </div>
            </div>
        </template>
    </UModal>
</template>
