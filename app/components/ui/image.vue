<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

interface Props {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    class?: string | string[];
}
const props = defineProps<Props>();

const openImage = ref(false);
</script>

<template>
    <button
        type="button"
        aria-label="画像を拡大"
        @click="openImage = true"
        :class="[
            'cursor-pointer p-1.5 rounded-xl ring-1 ring-zinc-400 dark:ring-zinc-700',
            'hover:ring-2 hover:ring-zinc-500 dark:hover:ring-zinc-600',
            'focus:ring-4 focus:ring-zinc-600 dark:focus:ring-zinc-500 focus:outline-hidden',
            'transition-all ease-in-out duration-100',
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
                    'shrink-0 grow-0 max-w-full max-h-full rounded-xl flex items-center justify-center',
                    props.class
                )
            "
        />
    </button>

    <DialogRoot v-model:open="openImage">
        <DialogPortal>
            <DialogOverlay class="bg-black/50 fixed inset-0 z-30" />
            <DialogContent as-child>
                <DialogClose
                    class="z-[101] fixed top-0 right-0 m-4 p-2 rounded-full cursor-pointer flex bg-zinc-900/60"
                >
                    <Icon name="lucide:x" size="24" />
                </DialogClose>
                <NuxtImg
                    :src="props.src"
                    :alt="props.alt"
                    class="z-[100] size-full max-h-fit max-w-fit fixed inset-0 place-self-center"
                />
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
