<script setup lang="ts">
import type { FetchResult } from '#app'

interface Props {
    setupId: Setup['id']
}
const { setupId } = defineProps<Props>()

const { data: setup, status } = await useFetch<FetchResult<'/api/setups/:id', 'get'>>(
    `/api/setups/${setupId}`,
    { dedupe: 'defer' },
)
</script>

<template>
    <UButton
        :to="`/setup/${setupId}`"
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
