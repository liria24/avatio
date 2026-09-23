<script setup lang="ts" generic="T">
import { animations, tearDown } from '@formkit/drag-and-drop'
import { dragAndDrop } from '@formkit/drag-and-drop/vue'

const props = defineProps<{
    modelValue: T[]
    handle: string
}>()
const emit = defineEmits<{
    'update:modelValue': [value: T[]]
}>()

const parent = useTemplateRef<HTMLElement>('parent')
const values = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
})

dragAndDrop({
    parent,
    values,
    dragHandle: props.handle,
    draggingClass: 'opacity-100',
    dragPlaceholderClass: 'opacity-0',
    synthDraggingClass: 'opacity-100',
    synthDragPlaceholderClass: 'opacity-0',
    plugins: [animations({ duration: 150 })],
})

onBeforeUnmount(() => {
    if (parent.value) tearDown(parent.value)
})
</script>

<template>
    <div ref="parent">
        <slot />
    </div>
</template>
