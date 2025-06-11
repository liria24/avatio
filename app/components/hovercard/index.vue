<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    disabled?: boolean
    side?: 'top' | 'bottom' | 'left' | 'right'
    sideOffset?: number
    closeDelay?: number
    class?: string | string[]
}
const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    directContent: false,
    side: 'bottom',
    sideOffset: 5,
    closeDelay: 0,
})
</script>

<template>
    <HoverCardRoot :open-delay="0" :close-delay="props.closeDelay">
        <HoverCardTrigger as-child>
            <slot name="trigger" />
        </HoverCardTrigger>
        <HoverCardPortal>
            <HoverCardContent
                v-if="!disabled"
                :side="props.side"
                :side-offset="props.sideOffset"
                :class="
                    twMerge(
                        'z-[200] max-w-[90vw] rounded-xl border border-zinc-300 bg-zinc-100 p-5 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900',
                        'animate-in fade-in data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
                        props.class
                    )
                "
            >
                <slot name="content" />

                <HoverCardArrow
                    class="fill-zinc-300 dark:fill-zinc-700"
                    :width="8"
                />
            </HoverCardContent>
        </HoverCardPortal>
    </HoverCardRoot>
</template>
