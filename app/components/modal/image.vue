<script setup lang="ts">
interface Props {
    src?: string
    alt?: string
}
const props = defineProps<Props>()
</script>

<template>
    <UModal
        :ui="{
            content: 'bg-transparent ring-0 max-w-xl rounded-none',
        }"
    >
        <template #content>
            <NuxtImg
                :src="props.src"
                :alt="props.alt"
                loading="lazy"
                fetch-priority="low"
                class="h-full object-contain"
            />
        </template>
    </UModal>
</template>
