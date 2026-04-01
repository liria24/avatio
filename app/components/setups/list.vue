<script lang="ts" setup>
import { MasonryWall } from '@yeger/vue-masonry-wall'

interface Props {
    setups?: ReturnType<typeof useSetupsList>['setups']['value']
    loading?: boolean
}
const { setups = [], loading = false } = defineProps<Props>()

const { isMobile } = useDevice()
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <Icon
            v-if="loading"
            name="svg-spinners:ring-resize"
            size="24"
            class="mt-4 self-center bg-zinc-500"
        />

        <p v-else-if="!setups?.length" class="text-muted mt-4 self-center text-center text-sm">
            {{ $t('search.listEmpty') }}
        </p>

        <MasonryWall
            v-else
            :items="setups"
            :column-width="240"
            :gap="6"
            :min-columns="2"
            :max-columns="3"
            :ssr-columns="isMobile ? 2 : 3"
        >
            <template #default="{ item, index }">
                <div
                    :style="{
                        'transition-property': 'translate, opacity, filter',
                        'transition-delay': `${50 * index}ms, ${50 * index}ms, ${50 * index}ms`,
                    }"
                    class="transition-discrete duration-400 starting:translate-y-3 starting:opacity-0 starting:blur-sm"
                >
                    <SetupsLink :setup="item" />
                </div>
            </template>
        </MasonryWall>
    </div>
</template>
