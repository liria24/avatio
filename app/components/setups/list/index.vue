<script lang="ts" setup>
interface Porps {
    minColumns?: number
    maxColumns?: number
    ssrColumns?: number
}
const props = withDefaults(defineProps<Porps>(), {
    minColumns: 2,
    maxColumns: 4,
    ssrColumns: 2,
})

const setups = defineModel<Setup[]>('setups', {
    default: [],
})
const loading = defineModel<boolean>('loading', {
    default: false,
})
</script>

<template>
    <Icon
        v-if="loading"
        name="svg-spinners:ring-resize"
        size="24"
        class="mt-4 self-center bg-zinc-500"
    />

    <p
        v-else-if="!setups?.length"
        class="text-muted mt-4 self-center text-center text-sm"
    >
        セットアップが見つかりませんでした
    </p>

    <MasonryWall
        v-else
        :items="setups"
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
