<script lang="ts" setup>
const client = useSupabaseClient();

const { data: release } = await client
    .from('releases')
    .select('slug, emoji, short_title, title, published')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
</script>

<template>
    <NuxtLink
        v-if="release"
        :to="{ name: 'release' }"
        tabindex="0"
        :class="[
            'cursor-pointer shrink px-3.5 py-3 rounded-xl',
            'flex items-center gap-1',
            'ring-1 ring-zinc-300 dark:ring-zinc-700',
            'hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-600',
            'focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 focus:outline-0',
            'transition-all duration-200 ease-in-out',
        ]"
    >
        <Icon :name="`twemoji:${release.emoji}`" size="14" class="shrink-0" />
        <span class="text-xs leading-none whitespace-nowrap">
            {{ release.short_title }}
        </span>
        <UiDivider class="hidden sm:flex w-6 mx-1" />
        <div class="hidden sm:inline">
            <span
                class="text-xs leading-none line-clamp-1 text-zinc-500 dark:text-zinc-400"
            >
                {{ release.title }}
            </span>
        </div>
    </NuxtLink>
</template>
