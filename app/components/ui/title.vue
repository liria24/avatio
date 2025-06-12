<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        is?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'
        size?: 'md' | 'lg'
        label: string
        icon?: string
        trailing?: string
        trailingIcon?: string
    }>(),
    {
        is: 'h1',
        size: 'md',
        icon: '',
        trailing: '',
        trailingIcon: 'lucide:arrow-right',
        infomation: '',
    }
)
</script>

<template>
    <div class="flex items-center justify-between">
        <div class="inline-flex items-center gap-1.5">
            <Icon
                v-if="props.icon.length"
                :name="props.icon"
                :size="props.size === 'md' ? 20 : 24"
                class="shrink-0 text-zinc-500 dark:text-zinc-400"
            />
            <component
                :is="props.is"
                :class="[
                    'whitespace-nowrap text-black dark:text-white',
                    props.size === 'md'
                        ? 'text-[15px] font-medium'
                        : 'text-xl font-bold',
                ]"
            >
                {{ props.label }}
            </component>
        </div>
        <button v-if="props.trailing" class="inline-flex items-center gap-1">
            <div class="text-sm text-black dark:text-zinc-400">
                {{ props.trailing }}
            </div>
            <Icon
                :name="props.trailingIcon"
                :size="18"
                class="text-zinc-600 dark:text-zinc-400"
            />
        </button>
    </div>
</template>
