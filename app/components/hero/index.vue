<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const props = defineProps<{ class?: string | string[] }>()

const user = useSupabaseUser()
</script>

<template>
    <div
        :class="
            twMerge(
                'relative flex w-full max-w-xl flex-col items-center gap-6 self-center py-12',
                props.class
            )
        "
    >
        <HeroDotBackground class="absolute inset-0 h-full w-full" />
        <LogoAvatio
            by-liria
            aria-label="Avatio by Liria"
            class="w-64 sm:w-96"
        />
        <p
            class="sm:text-md text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
            あなたのアバター改変を共有しよう
        </p>
        <Button
            v-if="!user"
            to="/login"
            class="rounded-full px-5 hover:bg-zinc-700 hover:text-zinc-200 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
        >
            <span class="pl-0.5">ログイン</span>
        </Button>
    </div>
</template>
