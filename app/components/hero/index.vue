<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

const { class: propClass } = defineProps<{ class?: string | string[] }>();
</script>

<template>
    <div
        :class="
            twMerge(
                'relative self-center w-full max-w-xl py-12 flex flex-col items-center gap-6',
                propClass
            )
        "
    >
        <HeroDotBackground class="absolute inset-0 w-full h-full" />
        <LogoAvatio
            by-liria
            aria-label="Avatio by Liria"
            class="w-64 sm:w-96"
        />
        <p
            class="text-sm sm:text-md font-medium text-zinc-600 dark:text-zinc-400"
        >
            あなたのアバター改変を共有しよう
        </p>
        <Button
            to="/setup/compose"
            class="px-5 rounded-full hover:bg-zinc-700 hover:text-zinc-200 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
        >
            <span class="pl-0.5">ログイン</span>
        </Button>
    </div>
</template>
