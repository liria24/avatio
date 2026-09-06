<script setup lang="ts">
interface Props {
    setupId: Setup['id']
}
const { setupId } = defineProps<Props>()
const setupPath = useSetupPath()

const { data: setup, status } = await useFetch<Setup>(`/api/me/setups/${setupId}`, {
    dedupe: 'defer',
    headers: useRequestHeaders(['cookie']),
})
</script>

<template>
    <UButton
        :to="setupPath(setupId)"
        target="_blank"
        :disabled="status === 'pending'"
        variant="outline"
        :prefetch="false"
        class="rounded-full"
    >
        <div v-if="status === 'pending'" class="flex">
            <Icon name="svg-spinners:ring-resize" size="18" />
        </div>

        <div
            v-else-if="setup"
            class="line-clamp-1 flex w-full items-center gap-1.5 pl-0.5 break-all"
        >
            <Icon name="mingcute:edit-3-fill" size="13" />
            <span class="text-muted text-left text-xs leading-none font-medium">
                {{ $t('setup.viewer.editing') }}
            </span>
            <span class="text-toned ml-1 grow text-left text-xs">
                {{ setup.name }}
            </span>
            <Icon name="mingcute:arrow-right-up-fill" size="18" />
        </div>
    </UButton>
</template>
