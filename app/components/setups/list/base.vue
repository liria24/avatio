<script lang="ts" setup>
interface Porps {
    loading?: boolean
    setups: SetupClient[]
    minColumns?: number
    maxColumns?: number
    ssrColumns?: number
}
const props = withDefaults(defineProps<Porps>(), {
    minColumns: 2,
    maxColumns: 4,
    ssrColumns: 2,
})
</script>

<template>
    <Icon
        v-if="props.loading"
        name="svg-spinners:ring-resize"
        size="24"
        class="mt-4 self-center bg-zinc-500"
    />

    <p
        v-else-if="!props.setups || !props.setups.length"
        class="mt-4 self-center text-center text-sm text-zinc-500 dark:text-zinc-400"
    >
        セットアップが見つかりませんでした
    </p>

    <MasonryWall
        v-else
        :items="props.setups"
        :column-width="240"
        :gap="6"
        :min-columns="props.minColumns"
        :max-columns="props.maxColumns"
        :ssr-columns="props.ssrColumns"
    >
        <template #default="{ item }">
            <SetupsLink
                :aria-label="item.name"
                :image-size="{ width: 16, height: 9 }"
                :setup="item"
                class="mb-2"
            />
        </template>
    </MasonryWall>
</template>
