<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    side?: 'top' | 'bottom' | 'left' | 'right'
    sideOffset?: number
    class?: string | string[]
}
const props = withDefaults(defineProps<Props>(), {
    side: 'bottom',
    sideOffset: 5,
})
</script>

<template>
    <PopoverRoot>
        <PopoverTrigger as-child>
            <slot name="trigger" />
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent
                :side="props.side"
                :side-offset="props.sideOffset"
                as-child
            >
                <div
                    :class="
                        twMerge(
                            'z-[200] flex flex-col gap-2 rounded-lg p-3',
                            'bg-zinc-50 dark:bg-zinc-900',
                            'shadow-lg shadow-black/10 dark:shadow-black/50',
                            'border border-zinc-300 dark:border-zinc-600',
                            'animate-in fade-in',
                            'data-[side=top]:slide-in-from-bottom-1 data-[side=top]:mx-2 data-[side=top]:mt-2',
                            'data-[side=bottom]:slide-in-from-top-1 data-[side=bottom]:mx-2 data-[side=bottom]:mb-2',
                            'data-[side=left]:slide-in-from-right-1 data-[side=left]:my-2 data-[side=left]:ml-2',
                            'data-[side=right]:slide-in-from-left-1 data-[side=right]:my-2 data-[side=right]:mr-2',
                            props.class
                        )
                    "
                >
                    <slot name="content" />
                </div>
                <PopoverArrow class="fill-zinc-300 dark:fill-zinc-600" />
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
