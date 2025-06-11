<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const props = defineProps<{
    label?: string
    icon?: string
    class?: string | string[]
    borderClass?: string
}>()
</script>

<template>
    <div :class="['align-center flex items-center text-center', props.class]">
        <div
            :class="
                twMerge(
                    'flex w-full border border-zinc-200 dark:border-zinc-800',
                    props.borderClass
                )
            "
        />

        <template v-if="props.label || props.icon || $slots.default">
            <div
                class="mx-3 flex font-medium whitespace-nowrap text-zinc-700 dark:text-zinc-200"
            >
                <slot>
                    <span v-if="props.label" class="text-sm">
                        {{ props.label }}
                    </span>
                    <Icon
                        v-else-if="props.icon"
                        :name="props.icon"
                        class="h-5 w-5 shrink-0"
                    />
                </slot>
            </div>

            <div
                :class="
                    twMerge(
                        'flex w-full border border-zinc-200 dark:border-zinc-800',
                        props.borderClass
                    )
                "
            />
        </template>
    </div>
</template>
