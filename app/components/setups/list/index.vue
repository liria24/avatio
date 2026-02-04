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

    <p v-else-if="!setups?.length" class="text-muted mt-4 self-center text-center text-sm">
        セットアップが見つかりませんでした
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
            <SetupsLink
                :aria-label="item.name"
                :image-size="{ width: 16, height: 9 }"
                :setup="item"
                :style="`animation-delay: ${50 * index}ms`"
                class="fade-in"
            />
        </template>
    </MasonryWall>
</template>

<style scoped>
.fade-in {
    opacity: 0;
    animation: fadeIn 400ms ease-in-out forwards;
}

@keyframes fadeIn {
    0% {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(4px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
    }
}
</style>
