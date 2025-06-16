<script lang="ts" setup>
interface Props {
    count: number
    max: number
}
const props = defineProps<Props>()

// 現在の文字数
const count = computed(() => props.count)

// 進捗パーセンテージ
// ・maxより大きければ95%,
// ・maxにぴったりの場合は100%に表示,
// ・その他の場合は、(count/props.max)*95 を表示
const percentage = computed(() => {
    if (count.value === props.max) return 100
    if (count.value > props.max) return 95
    return (count.value / props.max) * 95
})

// SVG の設定
const size = 20
const strokeWidth = 3
const radius = (size - strokeWidth) / 2
const circumference = 2 * Math.PI * radius
const dashOffset = computed(
    () => circumference - (percentage.value / 100) * circumference
)
</script>

<template>
    <UTooltip :text="`${count} / ${props.max}`" :delay-duration="0">
        <div>
            <svg
                :width="size"
                :height="size"
                class="-rotate-90 focus:outline-none"
            >
                <!-- 背景の円 -->
                <circle
                    :cx="size / 2"
                    :cy="size / 2"
                    :r="radius"
                    :stroke-width="strokeWidth"
                    class="fill-transparent stroke-zinc-400 dark:stroke-zinc-600"
                />
                <!-- 進捗を示す円 -->
                <circle
                    :data-exceeded="count > max"
                    :cx="size / 2"
                    :cy="size / 2"
                    :r="radius"
                    :stroke-width="strokeWidth"
                    stroke-linecap="round"
                    :stroke-dasharray="circumference"
                    :stroke-dashoffset="dashOffset"
                    :class="[
                        'stroke-zinc-700 dark:stroke-zinc-300',
                        'data-[exceeded=true]:stroke-red-500 data-[exceeded=true]:dark:stroke-red-400',
                        'fill-transparent',
                    ]"
                />
            </svg>
        </div>
    </UTooltip>
</template>
