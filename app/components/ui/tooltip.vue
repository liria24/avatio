<script setup lang="ts">
interface Props {
    text?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
}
const props = withDefaults(defineProps<Props>(), {
    text: '',
});
</script>

<template>
    <TooltipProvider>
        <TooltipRoot
            :disabled="
                !props.text.length &&
                (!$slots.content || !$slots.content({}).length)
            "
            :delay-duration="0"
        >
            <TooltipTrigger as-child>
                <slot />
            </TooltipTrigger>
            <TooltipContent
                :side="props.side"
                :align="props.align"
                :class="[
                    'z-[250] m-1 p-1.5 rounded-lg text-base font-normal leading-0',
                    'shadow-lg shadow-black/10 ring-1 ring-zinc-300 dark:ring-zinc-700 bg-zinc-100 dark:bg-zinc-900',
                    'animate-in fade-in data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
                ]"
            >
                <slot name="content">
                    <span
                        class="empty:hidden px-1 text-xs whitespace-nowrap font-normal leading-none"
                    >
                        {{ props.text }}
                    </span>
                </slot>
            </TooltipContent>
        </TooltipRoot>
    </TooltipProvider>
</template>
