<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const props = defineProps<{ class?: string | string[] }>()

const client = useSupabaseClient()

const { data: release } = await client
    .from('releases')
    .select('slug, emoji, short_title, title, published')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
</script>

<template>
    <NuxtLink
        v-if="release"
        :to="{ name: 'release' }"
        tabindex="0"
        :class="
            twMerge(
                'shrink cursor-pointer rounded-xl px-3.5 py-3',
                'flex items-center gap-1',
                'ring-1 ring-zinc-300 dark:ring-zinc-700',
                'hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-600',
                'focus:outline-0 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600',
                'transition-all duration-200 ease-in-out',
                props.class
            )
        "
    >
        <Icon :name="`twemoji:${release.emoji}`" size="14" class="shrink-0" />
        <span class="text-xs leading-none whitespace-nowrap">
            {{ release.short_title }}
        </span>

        <USeparator class="mx-1 flex w-6" />

        <span
            class="line-clamp-1 text-xs leading-none text-zinc-500 dark:text-zinc-400"
        >
            {{ release.title }}
        </span>
    </NuxtLink>
</template>
