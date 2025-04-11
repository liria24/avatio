<script lang="ts" setup>
interface Props {
    title: string;
    description?: string;
}

const props = defineProps<Props>();
</script>

<template>
    <ToastRoot
        v-slot="{ duration, remaining }"
        :class="[
            'w-fit min-w-md rounded-lg p-1 flex flex-col gap-2 items-start overflow-hidden',
            'ring-1 ring-zinc-300 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-950',
            'shadow-lg shadow-black/10 dark:shadow-black',
            'animate-in data-[state=open]:fade-in',
            'data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)]',
        ]"
    >
        <div
            class="w-full px-3 pt-2.5 pb-1.5 flex gap-4 justify-between items-start"
        >
            <ToastTitle class="font-bold text-sm pt-0.5">
                {{ props.title }}
            </ToastTitle>

            <ToastClose
                :class="[
                    'p-1 cursor-pointer rounded-md flex',
                    'hover:bg-zinc-600',
                ]"
            >
                <Icon name="lucide:x" :size="16" />
            </ToastClose>
        </div>
        <ToastDescription class="empty:hidden px-3 text-xs text-zinc-300">
            {{ props.description }}
        </ToastDescription>

        <div
            class="h-1 rounded-md bg-zinc-600 dark:bg-zinc-400"
            :style="{
                width: `${(remaining / duration) * 100 || 0}%`,
            }"
        />
    </ToastRoot>
</template>
