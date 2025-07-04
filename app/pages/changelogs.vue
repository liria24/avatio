<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'

const nuxtApp = useNuxtApp()

const { data } = await useFetch<PaginationResponse<Changelog[]>>(
    '/api/changelogs',
    {
        default: () => ({
            data: [],
            pagination: {
                page: 1,
                limit: 0,
                total: 0,
                totalPages: 0,
                hasPrev: false,
                hasNext: false,
            },
        }),
        dedupe: 'defer',
        getCachedData: (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    }
)

const items = computed<TimelineItem[]>(() =>
    data.value.data.map((item) => ({
        date: item.createdAt,
        title: item.title,
        description: item.html,
        slug: item.slug,
    }))
)
</script>

<template>
    <div class="flex w-full grid-cols-2 flex-col gap-6 pt-8 lg:grid">
        <div class="flex flex-col gap-4">
            <h1 class="text-3xl font-bold">変更履歴</h1>
            <p class="text-muted"></p>
        </div>

        <UTimeline
            :items="items"
            color="neutral"
            size="2xs"
            :ui="{
                item: 'gap-8',
                container: 'pt-2',
                wrapper: 'space-y-4',
                description: 'pl-0.5',
                date: 'float-end',
            }"
            class="w-full max-w-2xl self-center lg:self-auto"
        >
            <template #title="{ item }">
                <NuxtLink
                    :to="`/changelogs/${item.slug}`"
                    class="underline-offset-4 hover:underline"
                >
                    <h2 class="text-2xl font-bold">{{ item.title }}</h2>
                </NuxtLink>
            </template>

            <template #description="{ item }">
                <div
                    class="prose prose-zinc dark:prose-invert prose-sm"
                    v-html="item.description"
                />
            </template>

            <template #date="{ item }">
                <NuxtTime
                    v-if="item.date"
                    :datetime="item.date"
                    class="text-muted text-sm"
                />
            </template>
        </UTimeline>
    </div>
</template>
