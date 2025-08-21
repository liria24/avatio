<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const nuxtApp = useNuxtApp()

const { data: setup, status } = await useFetch(`/api/setups/${props.setupId}`, {
    getCachedData: (key: string) =>
        nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})
</script>

<template>
    <UButton
        :to="`/setup/${setup?.id}`"
        target="_blank"
        :disabled="status === 'pending'"
        variant="outline"
        class="rounded-full"
    >
        <div v-if="status === 'pending'" class="flex">
            <Icon name="svg-spinners:ring-resize" size="18" />
        </div>

        <div
            v-else-if="setup"
            class="line-clamp-1 flex w-full items-center gap-1.5 pl-0.5 break-all"
        >
            <Icon name="lucide:pen-line" size="13" />
            <span class="text-muted text-left text-xs font-semibold">
                編集中
            </span>
            <span class="text-toned ml-1 grow text-left text-xs">
                {{ setup.name }}
            </span>
            <Icon name="lucide:arrow-up-right" size="18" />
        </div>
    </UButton>
</template>
