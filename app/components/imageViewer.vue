<script setup lang="ts">
interface Props {
    src: string
    alt?: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
let returnFocus: HTMLElement | null = null

const rememberFocus = () => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}
const restoreFocus = (event: Event) => {
    if (!returnFocus?.isConnected) return
    event.preventDefault()
    returnFocus.focus({ preventScroll: true })
}
</script>

<template>
    <UModal
        v-model:open="open"
        fullscreen
        :title="props.alt || $t('imageViewer.title')"
        :content="{ onOpenAutoFocus: rememberFocus, onCloseAutoFocus: restoreFocus }"
        :ui="{ content: 'bg-transparent' }"
    >
        <template #content>
            <img
                :src="props.src"
                :alt="props.alt || ''"
                class="size-full max-h-full max-w-full object-contain"
            />
            <UButton
                type="button"
                icon="mingcute:close-line"
                :aria-label="$t('close')"
                color="neutral"
                variant="solid"
                class="absolute top-4 right-4 rounded-full"
                @click="open = false"
            />
        </template>
    </UModal>
</template>
