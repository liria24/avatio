<script lang="ts" setup>
interface Props {
    title: string
    description?: string
}

const props = defineProps<Props>()
</script>

<template>
    <ToastRoot
        v-slot="{ duration, remaining }"
        :class="[
            'flex w-fit min-w-md flex-col items-start gap-2 overflow-hidden rounded-lg p-1',
            'bg-zinc-50 ring-1 ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-700',
            'shadow-lg shadow-black/10 dark:shadow-black',
            'animate-in data-[state=open]:fade-in',
            'data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)]',
        ]"
    >
        <div
            class="flex w-full items-start justify-between gap-4 px-3 pt-2.5 pb-1.5"
        >
            <ToastTitle class="pt-0.5 text-sm font-bold">
                {{ props.title }}
            </ToastTitle>

            <ToastClose
                :class="[
                    'flex cursor-pointer rounded-md p-1',
                    'hover:bg-zinc-600',
                ]"
            >
                <Icon name="lucide:x" :size="16" />
            </ToastClose>
        </div>
        <ToastDescription class="px-3 text-xs text-zinc-300 empty:hidden">
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
