<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right'
    class?: string | string[]
}
const props = withDefaults(defineProps<Props>(), {
    anchor: 'center',
})

const vis = defineModel<boolean>({
    default: false,
})

const slots = useSlots() as Record<string, (() => VNode[]) | undefined>

const emit = defineEmits(['update:open'])
</script>

<template>
    <DialogRoot v-model:open="vis" @update:open="emit('update:open', $event)">
        <!-- <DialogTrigger as-child>
            <slot name="trigger" />
        </DialogTrigger> -->
        <DialogPortal>
            <DialogOverlay
                class="animate-in fade-in fixed inset-0 z-30 backdrop-blur-md transition-all duration-200 ease-in-out"
            />
            <DialogContent
                :data-anchor="props.anchor"
                :class="
                    twMerge(
                        'fixed z-[100] flex max-h-[85vh] w-[90vw] max-w-[450px] flex-col gap-3.5 place-self-center p-4',
                        'rounded-2xl border border-zinc-300 bg-zinc-100 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-900',
                        'shadow-xl shadow-black/10 dark:shadow-black/50',
                        'animate-in slide-in-from-bottom-3 fade-in ease-in-out',
                        'data-[anchor=center]:inset-0',
                        'data-[anchor=top]:top-0 data-[anchor=top]:right-0 data-[anchor=top]:left-0',
                        'data-[anchor=bottom]:right-0 data-[anchor=bottom]:bottom-0 data-[anchor=bottom]:left-0',
                        'data-[anchor=left]:top-0 data-[anchor=left]:bottom-0 data-[anchor=left]:left-0',
                        'data-[anchor=right]:top-0 data-[anchor=right]:right-0 data-[anchor=right]:bottom-0',
                        props.class
                    )
                "
            >
                <slot name="header" />
                <USeparator v-if="slots.header && slots.header().length" />
                <slot />
                <USeparator v-if="slots.footer && slots.footer().length" />
                <slot name="footer" />

                <!-- <DialogClose
                    class="text-grass11 hover:bg-green4 focus:shadow-green7 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-hidden"
                    aria-label="Close"
                >
                    <Icon name="lucide:x" />
                </DialogClose> -->
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
