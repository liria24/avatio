<script lang="ts" setup>
import { SetupsLink } from '#components'
import { motion } from 'motion-v'

const MotionLazySetupsLink = motion.create(SetupsLink)

const { isMobile } = useDevice()

const setups = defineModel<SerializedSetup[]>('setups', {
    default: [],
})
const loading = defineModel<boolean>('loading', {
    default: false,
})

const isInitialLoad = ref(true)
onMounted(async () => {
    await setTimeout(() => {
        isInitialLoad.value = false
    }, 100)
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
        <template #default="{ item, index }">
            <MotionLazySetupsLink
                :aria-label="item.name"
                :image-size="{ width: 16, height: 9 }"
                :setup="item"
                :initial="{
                    opacity: 0,
                    y: 10,
                }"
                :in-view="{
                    opacity: 1,
                    y: 0,
                }"
                :in-view-options="{
                    once: true,
                    amount: 0.4,
                }"
                :transition="{
                    duration: 0.2,
                    delay: isInitialLoad ? 0.1 + 0.05 * index : 0,
                }"
                class="mb-2"
            />
        </template>
    </MasonryWall>
</template>
