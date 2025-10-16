<script setup lang="ts">
interface Props {
    src: string
    alt?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
    close: []
}>()

const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) emit('close')
}

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') emit('close')
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
})
</script>

<template>
    <Teleport to="body">
        <div
            class="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm"
            @click="handleOverlayClick"
        >
            <img
                :src="props.src"
                :alt="props.alt"
                class="size-full max-h-full max-w-full object-contain"
                @click="emit('close')"
            />
        </div>
    </Teleport>
</template>
