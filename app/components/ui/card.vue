<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    divider?: boolean
    class?: string | string[]
    headerClass?: string | string[]
    contentClass?: string | string[]
    footerClass?: string | string[]
}
const props = withDefaults(defineProps<Props>(), {
    divider: true,
})
</script>

<template>
    <div
        :class="
            twMerge(
                'flex flex-col rounded-lg ring-1 ring-zinc-300 dark:ring-zinc-600',
                props.divider
                    ? 'divide-y divide-zinc-300 dark:divide-zinc-600'
                    : '',
                props.class
            )
        "
    >
        <div
            v-if="$slots.header && $slots.header({}).length"
            :class="twMerge('px-4 py-3 empty:hidden', props.headerClass)"
        >
            <slot name="header" />
        </div>
        <div
            v-if="$slots.default && $slots.default({}).length"
            :class="
                twMerge(
                    'px-4 empty:hidden',
                    props.divider ? 'py-3' : 'py-1',
                    props.contentClass
                )
            "
        >
            <slot />
        </div>
        <div
            v-if="$slots.footer && $slots.footer({}).length"
            :class="twMerge('px-4 py-3 empty:hidden', props.footerClass)"
        >
            <slot name="footer" />
        </div>
    </div>
</template>
