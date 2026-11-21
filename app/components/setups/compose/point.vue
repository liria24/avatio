<script setup lang="ts">
type Position = Pick<SetupPoint, 'x' | 'y'>
const props = defineProps<{
    point: SetupPoint
    name: string
    image?: string | null
    surface?: HTMLImageElement | null
    selected: boolean
    disabled: boolean
    describedby: string
}>()
const emit = defineEmits<{
    select: []
    moveStart: []
    move: [position: Position]
    moveEnd: [position: Position]
    moveCancel: []
}>()
const marker = useTemplateRef<HTMLButtonElement>('marker')
let start: { clientX: number; clientY: number; x: number; y: number } | undefined
let position: Position | undefined
let keyboardPosition: Position | undefined
let dragged = false
let suppressClick = false
const finishKeyboard = () => {
    if (!keyboardPosition) return
    const next = keyboardPosition
    keyboardPosition = undefined
    emit('moveEnd', next)
}
useDraggable(marker, {
    preventDefault: true,
    stopPropagation: true,
    disabled: () => props.disabled,
    onStart: (_position, event) => {
        if (!props.surface || start) return false
        finishKeyboard()
        start = {
            clientX: event.clientX,
            clientY: event.clientY,
            x: props.point.x,
            y: props.point.y,
        }
        dragged = false
        suppressClick = false
        marker.value?.setPointerCapture?.(event.pointerId)
    },
    onMove: (_position, event) => {
        if (!start || !props.surface) return
        const dx = event.clientX - start.clientX
        const dy = event.clientY - start.clientY
        if (!dragged && Math.hypot(dx, dy) < 5) return
        if (!dragged) {
            dragged = true
            emit('moveStart')
        }
        const bounds = props.surface.getBoundingClientRect()
        position = normalizeSetupPoint(
            bounds.left + start.x * bounds.width + dx,
            bounds.top + start.y * bounds.height + dy,
            bounds,
        )
        emit('move', position)
    },
    onEnd: (_position, event) => {
        if (dragged) {
            suppressClick = true
            if (event.type === 'pointercancel' || !position) emit('moveCancel')
            else emit('moveEnd', position)
            marker.value?.focus()
        }
        start = undefined
        position = undefined
        dragged = false
    },
})
const onClick = () => {
    if (suppressClick) {
        suppressClick = false
        return
    }
    emit('select')
}
const onKeydown = (event: KeyboardEvent) => {
    suppressClick = false
    if (event.key === 'Escape' && keyboardPosition) {
        event.preventDefault()
        event.stopPropagation()
        keyboardPosition = undefined
        emit('moveCancel')
        return
    }
    const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
    }[event.key]
    if (!direction || !props.surface || props.disabled) return
    event.preventDefault()
    event.stopPropagation()
    if (!keyboardPosition) {
        keyboardPosition = { x: props.point.x, y: props.point.y }
        emit('moveStart')
    }
    const bounds = props.surface.getBoundingClientRect()
    const step = event.shiftKey ? 10 : 1
    keyboardPosition = normalizeSetupPoint(
        bounds.left + keyboardPosition.x * bounds.width + direction[0]! * step,
        bounds.top + keyboardPosition.y * bounds.height + direction[1]! * step,
        bounds,
    )
    emit('move', keyboardPosition)
}
const cancel = () => {
    start = undefined
    position = undefined
    keyboardPosition = undefined
    dragged = false
    suppressClick = true
}
defineExpose({ cancel })
</script>

<template>
    <button
        ref="marker"
        type="button"
        :data-point-id="point.id"
        :style="setupPointStyle(point)"
        :aria-label="name"
        :aria-describedby="describedby"
        :aria-pressed="selected"
        :disabled="disabled"
        class="absolute grid size-11 -translate-1/2 cursor-grab touch-none place-items-center overflow-hidden rounded-full bg-white shadow-lg ring-2 outline-none select-none focus-visible:ring-4 active:cursor-grabbing"
        :class="selected ? 'ring-primary' : 'ring-default'"
        @click.stop="onClick"
        @keydown="onKeydown"
        @keyup="
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes($event.key) &&
            finishKeyboard()
        "
        @blur="finishKeyboard"
    >
        <NuxtImg
            v-if="image"
            :src="image"
            alt=""
            width="44"
            height="44"
            draggable="false"
            class="pointer-events-none size-full object-cover"
        />
        <Icon
            v-else
            name="mingcute:package-2-fill"
            size="22"
            class="pointer-events-none text-neutral-800"
        />
    </button>
</template>
