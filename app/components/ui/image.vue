<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    src: string
    alt: string
    width?: number
    height?: number
    class?: string | string[]
}
const props = defineProps<Props>()

const openImage = ref(false)
</script>

<template>
    <button
        type="button"
        aria-label="画像を拡大"
        @click="openImage = true"
        :class="[
            'cursor-pointer rounded-xl p-1.5 ring-1 ring-zinc-400 dark:ring-zinc-700',
            'hover:ring-2 hover:ring-zinc-500 dark:hover:ring-zinc-600',
            'focus:ring-4 focus:ring-zinc-600 focus:outline-hidden dark:focus:ring-zinc-500',
            'transition-all duration-100 ease-in-out',
        ]"
    >
        <NuxtImg
            :src="props.src"
            :alt="props.alt"
            :width="props.width"
            :height="props.height"
            :placeholder="[props.width, props.height, 70, 5]"
            :class="
                twMerge(
                    'flex max-h-full max-w-full shrink-0 grow-0 items-center justify-center rounded-xl',
                    props.class
                )
            "
        />
    </button>

    <DialogRoot v-model:open="openImage">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-30 bg-black/50" />
            <DialogContent as-child>
                <DialogClose
                    class="fixed top-0 right-0 z-[101] m-4 flex cursor-pointer rounded-full bg-zinc-900/60 p-2"
                >
                    <Icon name="lucide:x" size="24" />
                </DialogClose>
                <NuxtImg
                    :src="props.src"
                    :alt="props.alt"
                    class="fixed inset-0 z-[100] size-full max-h-fit max-w-fit place-self-center"
                />
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
