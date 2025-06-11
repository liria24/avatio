<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    loading: boolean
    class?: string | string[]
}
const props = defineProps<Props>()

const emit = defineEmits(['click'])
</script>

<template>
    <Button
        :disabled="props.loading"
        label="さらに読み込む"
        :icon="props.loading ? 'svg-spinners:ring-resize' : ''"
        :class="twMerge('h-10', props.class)"
        @click="emit('click')"
    />
</template>
