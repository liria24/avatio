<script setup lang="ts">
interface Props {
    icon?: string
    title?: string
    description?: string
    color?: 'error' | 'info' | 'success' | 'primary' | 'secondary' | 'warning' | 'neutral'
    variant?: 'subtle' | 'solid' | 'outline' | 'soft'
}
const props = defineProps<Props>()
</script>

<template>
    <UAlert
        :icon="props.icon"
        :title="props.title"
        :description="props.description"
        :color="props.color"
        :variant="props.variant"
        class="my-2"
    >
        <template #description>
            <div class="whitespace-pre-wrap">
                <slot />
            </div>
        </template>
    </UAlert>
</template>
