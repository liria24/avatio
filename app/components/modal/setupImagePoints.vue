<script setup lang="ts">
type Position = Pick<SetupPoint, 'x' | 'y'>
type Interaction =
    | { kind: 'add'; position: Position }
    | { kind: 'select'; id: string }
    | { kind: 'move'; id: string }
    | { kind: 'place'; entryId: string }

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
    imageUrl: string
    imageId: string
    width?: number
    height?: number
    entries: { id: string; name: string; image: string | null }[]
    points: SetupPoint[]
    totalPoints: number
    placingEntryId?: string
}>()
const emit = defineEmits<{ 'update:points': [points: SetupPoint[]] }>()
const { t } = useI18n()
const image = useTemplateRef<HTMLImageElement>('image')
const addButton = ref<{ $el?: HTMLButtonElement }>()
const markers = useTemplateRef<{ cancel: () => void }[]>('markers')
const helpId = useId()
const {
    width: renderedWidth,
    height: renderedHeight,
    update: updateBounds,
} = useElementBounding(image)
const loaded = ref(false)
const failed = ref(false)
const ready = computed(() => loaded.value && renderedWidth.value > 0 && renderedHeight.value > 0)
const canAdd = computed(() => ready.value && props.entries.length > 0 && props.totalPoints < 128)
const interaction = ref<Interaction | null>(
    props.placingEntryId ? { kind: 'place', entryId: props.placingEntryId } : null,
)
const selectedId = ref<string>()
const preview = ref<{ id: string; position: Position }>()
const changingItem = ref(false)
const search = ref('')
const swallowImageClick = ref(false)
const pickerInput = computed(() => ({
    placeholder: t('setup.compose.points.selectItem'),
    'aria-label': t('setup.compose.points.selectItem'),
}))
const popoverLabel = computed(() => ({ 'aria-label': t('setup.compose.points.selectItem') }))
const selected = computed(() => props.points.find(({ id }) => id === selectedId.value))
const entryFor = (id: string) => props.entries.find((entry) => entry.id === id)
const pickerOpen = computed(
    () => interaction.value?.kind === 'add' || interaction.value?.kind === 'select',
)
const anchorPosition = computed(() =>
    interaction.value?.kind === 'add'
        ? interaction.value.position
        : (selected.value ?? { x: 0.5, y: 0.5 }),
)
const { commit, undo, redo, canUndo, canRedo } = useSetupPointHistory(
    toRef(() => props.points),
    (next) => emit('update:points', next),
)
const focusSelected = () =>
    nextTick(() => {
        const marker = selectedId.value
            ? image.value?.parentElement?.querySelector<HTMLButtonElement>(
                  `[data-point-id="${CSS.escape(selectedId.value)}"]`,
              )
            : undefined
        if (marker) marker.focus()
        else addButton.value?.$el?.focus()
    })
const cancel = (focus = true) => {
    interaction.value = null
    preview.value = undefined
    search.value = ''
    changingItem.value = false
    for (const marker of markers.value ?? []) marker.cancel()
    if (focus) void focusSelected()
}
const selectPoint = (id: string) => {
    cancel(false)
    swallowImageClick.value = false
    selectedId.value = id
    interaction.value = { kind: 'select', id }
}
const addAt = (position: Position) => {
    if (!canAdd.value) return
    cancel(false)
    interaction.value = { kind: 'add', position }
}
const chooseItem = (entryId: string) => {
    if (!entryFor(entryId)) return
    const current = interaction.value
    if (!current) return
    if (current.kind === 'select') {
        commit(
            props.points.map((point) => (point.id === current.id ? { ...point, entryId } : point)),
        )
        selectedId.value = current.id
    } else if (current.kind === 'add' && canAdd.value) {
        const point = {
            id: crypto.randomUUID(),
            imageId: props.imageId,
            entryId,
            ...current.position,
        }
        commit([...props.points, point])
        selectedId.value = point.id
    } else return
    cancel()
}
const moveTo = (id: string, position: Position) => {
    commit(props.points.map((point) => (point.id === id ? { ...point, ...position } : point)))
    selectedId.value = id
    cancel()
}
const onImageClick = (event: MouseEvent) => {
    if (swallowImageClick.value) {
        swallowImageClick.value = false
        return
    }
    if (!ready.value || !image.value) return
    if (pickerOpen.value) {
        cancel(false)
        return
    }
    const position = normalizeSetupPoint(
        event.clientX,
        event.clientY,
        image.value.getBoundingClientRect(),
    )
    if (interaction.value?.kind === 'move') moveTo(interaction.value.id, position)
    else if (interaction.value?.kind === 'place') {
        const entryId = interaction.value.entryId
        addAt(position)
        chooseItem(entryId)
    } else addAt(position)
}
const deletePoint = () => {
    if (!selected.value) return
    const next = props.points.filter(({ id }) => id !== selectedId.value)
    commit(next)
    selectedId.value = next[0]?.id
    cancel()
}
const moveStart = (id: string) => {
    interaction.value = null
    search.value = ''
    changingItem.value = false
    preview.value = undefined
    selectedId.value = id
}
const applyHistory = (action: () => void) => {
    cancel(false)
    action()
    void focusSelected()
}
const moveSelected = () => {
    if (!selected.value) return
    interaction.value = { kind: 'move', id: selected.value.id }
    void focusSelected()
}
const onImageLoad = () => {
    loaded.value = true
    failed.value = false
    updateBounds()
}
const onImageError = () => {
    failed.value = true
    loaded.value = false
}
const groups = computed(() => [
    {
        id: 'entries',
        items: props.entries.map((entry) => ({
            id: entry.id,
            label: entry.name,
            avatar: {
                src: entry.image || undefined,
                icon: 'mingcute:package-2-fill',
                alt: '',
                class: 'rounded-md',
            },
            suffix: t('setup.compose.points.placedCount', {
                count: props.points.filter((point) => point.entryId === entry.id).length,
            }),
            onSelect: () => chooseItem(entry.id),
        })),
    },
])
useEventListener(
    import.meta.client ? window : undefined,
    'keydown',
    (event: KeyboardEvent) => {
        if (!open.value) return
        if (event.key === 'Escape' && (interaction.value || preview.value)) {
            event.preventDefault()
            event.stopPropagation()
            cancel()
        } else if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            ['z', 'y'].includes(event.key.toLowerCase())
        ) {
            const target = event.target
            if (
                target instanceof Element &&
                target.closest('input,textarea,[contenteditable="true"]')
            )
                return
            event.preventDefault()
            applyHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? redo : undo)
        }
    },
    { capture: true },
)
onMounted(() => {
    if (image.value?.complete && image.value.naturalWidth > 0) {
        loaded.value = true
        updateBounds()
    }
})
</script>

<template>
    <UModal
        v-model:open="open"
        :title="$t('setup.compose.points.title')"
        :description="$t('setup.compose.points.description')"
        :ui="{ content: 'sm:max-w-6xl' }"
    >
        <template #body>
            <div class="flex min-h-[50vh] flex-col gap-4">
                <div class="flex flex-wrap items-center gap-2">
                    <UButton
                        ref="addButton"
                        :label="$t('setup.compose.points.add')"
                        icon="mingcute:add-line"
                        variant="soft"
                        :ui="{ label: 'text-toned' }"
                        :disabled="!canAdd"
                        @click="addAt({ x: 0.5, y: 0.5 })"
                    />
                    <UButton
                        :label="$t('setup.compose.points.undo')"
                        icon="mingcute:back-line"
                        color="neutral"
                        variant="ghost"
                        :disabled="!canUndo"
                        @click="applyHistory(undo)"
                    />
                    <UButton
                        :label="$t('setup.compose.points.redo')"
                        icon="mingcute:forward-line"
                        color="neutral"
                        variant="ghost"
                        :disabled="!canRedo"
                        @click="applyHistory(redo)"
                    />
                    <span class="text-toned ml-auto text-xs">{{
                        $t('setup.compose.points.count', { count: totalPoints, max: 128 })
                    }}</span>
                </div>
                <p :id="helpId" class="text-toned text-sm">{{ $t('setup.compose.points.help') }}</p>
                <p v-if="!ready && !failed" role="status" class="text-toned text-sm">
                    {{ $t('loading') }}
                </p>
                <UAlert
                    v-if="!entries.length || totalPoints >= 128 || failed"
                    color="warning"
                    variant="soft"
                    :title="
                        $t(
                            'setup.compose.points.' +
                                (failed ? 'imageFailed' : !entries.length ? 'noItems' : 'limit'),
                        )
                    "
                />
                <UAlert
                    v-if="interaction?.kind === 'move' || interaction?.kind === 'place'"
                    variant="soft"
                    :title="
                        interaction.kind === 'move'
                            ? $t('setup.compose.points.clickToMove')
                            : $t('setup.compose.points.clickToPlace', {
                                  name: entryFor(interaction.entryId)?.name,
                              })
                    "
                    :actions="[{ label: $t('cancel'), variant: 'ghost', onClick: () => cancel() }]"
                />
                <div class="relative m-auto w-fit max-w-full">
                    <img
                        ref="image"
                        :src="imageUrl"
                        :width="width"
                        :height="height"
                        :alt="$t('setup.compose.images.preview')"
                        draggable="false"
                        class="block h-auto max-h-[min(60dvh,max(12rem,calc(100dvh-28rem)))] w-auto max-w-full rounded-xl sm:max-h-[min(60dvh,max(12rem,calc(100dvh-24rem)))]"
                        :class="ready && entries.length ? 'cursor-crosshair' : undefined"
                        @load="onImageLoad"
                        @error="onImageError"
                        @click="onImageClick"
                    />
                    <SetupsComposePoint
                        v-for="point in points"
                        :key="point.id"
                        ref="markers"
                        :point="
                            preview?.id === point.id ? { ...point, ...preview.position } : point
                        "
                        :name="entryFor(point.entryId)?.name ?? point.entryId"
                        :image="entryFor(point.entryId)?.image"
                        :surface="image"
                        :selected="selectedId === point.id"
                        :disabled="!ready"
                        :describedby="helpId"
                        @select="selectPoint(point.id)"
                        @move-start="moveStart(point.id)"
                        @move="preview = { id: point.id, position: $event }"
                        @move-end="moveTo(point.id, $event)"
                        @move-cancel="cancel()"
                    />
                    <UPopover
                        :open="pickerOpen"
                        :content="{
                            ...popoverLabel,
                            side: 'right',
                            align: 'center',
                            prioritizePosition: true,
                            collisionPadding: 16,
                            onCloseAutoFocus: (event) => event.preventDefault(),
                            onFocusOutside: (event) => event.preventDefault(),
                            onPointerDownOutside: (event) => {
                                if (pickerOpen && event.detail.originalEvent.target === image)
                                    swallowImageClick = true
                            },
                        }"
                        :ui="{ content: 'w-80 max-w-[calc(100vw-2rem)]' }"
                        @update:open="!$event && pickerOpen && cancel(false)"
                    >
                        <template #anchor>
                            <span
                                :style="setupPointStyle(anchorPosition)"
                                aria-hidden="true"
                                class="pointer-events-none absolute size-3 -translate-1/2 rounded-full"
                                :class="
                                    interaction?.kind === 'add'
                                        ? 'bg-primary ring-default shadow ring-2'
                                        : 'opacity-0'
                                "
                            />
                        </template>
                        <template #content>
                            <div
                                class="flex max-h-[min(24rem,var(--reka-popper-available-height))] flex-col gap-2 overflow-y-auto p-2"
                            >
                                <template
                                    v-if="
                                        interaction?.kind === 'select' && selected && !changingItem
                                    "
                                >
                                    <p class="text-toned px-2 py-1 text-sm font-medium">
                                        {{ entryFor(selected.entryId)?.name }}
                                    </p>
                                    <UButton
                                        :label="$t('setup.compose.points.changeItem')"
                                        icon="mingcute:package-2-fill"
                                        variant="soft"
                                        :ui="{ label: 'text-toned' }"
                                        @click="changingItem = true"
                                    />
                                    <UButton
                                        :label="$t('setup.compose.points.move')"
                                        icon="mingcute:move-fill"
                                        variant="soft"
                                        :ui="{ label: 'text-toned' }"
                                        @click="moveSelected"
                                    />
                                    <UButton
                                        :label="$t('setup.compose.points.remove')"
                                        icon="mingcute:delete-2-fill"
                                        color="error"
                                        variant="soft"
                                        :ui="{ label: 'text-toned' }"
                                        @click="deletePoint"
                                    />
                                </template>
                                <UCommandPalette
                                    v-else
                                    v-model:search-term="search"
                                    :groups="groups"
                                    :placeholder="$t('setup.compose.points.selectItem')"
                                    :input="pickerInput"
                                    autofocus
                                    :ui="{
                                        viewport: 'max-h-56',
                                        itemLabelBase: 'text-toned',
                                        itemLabelSuffix: 'text-toned',
                                    }"
                                />
                                <UButton
                                    :label="$t('cancel')"
                                    color="neutral"
                                    variant="ghost"
                                    block
                                    @click="cancel()"
                                />
                            </div>
                        </template>
                    </UPopover>
                </div>
            </div>
        </template>
        <template #footer>
            <div class="flex w-full flex-wrap items-center justify-between gap-2">
                <slot name="save-status" />
                <UButton
                    :label="$t('setup.compose.points.done')"
                    color="neutral"
                    class="ml-auto"
                    @click="open = false"
                />
            </div>
        </template>
    </UModal>
</template>
