<script lang="ts" setup>
const { isMobile } = useDevice()

const setups = defineModel<SerializedSetup[]>('setups', {
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
        :min-columns="2"
        :max-columns="4"
        :ssr-columns="isMobile ? 2 : 3"
    >
        <template #default="{ item }">
            <LazySetupsLink
                :aria-label="item.name"
                :image-size="{ width: 16, height: 9 }"
                :setup="item"
                class="mb-2"
            />
        </template>
    </MasonryWall>
</template>
