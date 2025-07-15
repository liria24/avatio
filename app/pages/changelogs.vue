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
        description: item.markdown,
        slug: item.slug,
        authors: item.authors,
        icon: 'lucide:check',
    }))
)

defineSeo({
    title: '変更履歴',
    description: 'Avatio の変更履歴を確認できます。',
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">変更履歴</h1>

        <UTimeline
            :items="items"
            color="neutral"
            size="2xs"
            :ui="{
                item: 'gap-8',
                container: 'pt-2',
                wrapper: 'space-y-4 pb-28',
                description: 'pl-0.5',
                date: 'float-end',
            }"
            class="w-full self-center"
        >
            <template #title="{ item }">
                <!-- <NuxtLink
                    :to="`/changelogs/${item.slug}`"
                    class="underline-offset-4 hover:underline"
                >
                    <h2 class="text-2xl font-bold">{{ item.title }}</h2>
                </NuxtLink> -->
                <h2 class="text-2xl font-bold">{{ item.title }}</h2>
            </template>

            <template #description="{ item }">
                <div class="flex flex-col gap-4">
                    <UAvatarGroup>
                        <ULink
                            v-for="author in item.authors"
                            :key="author.id"
                            :to="`/@${author.id}`"
                            raw
                        >
                            <UTooltip :text="author.name" :delay-duration="100">
                                <UAvatar
                                    :src="author.image"
                                    :alt="author.name"
                                    size="xs"
                                />
                            </UTooltip>
                        </ULink>
                    </UAvatarGroup>

                    <!-- <div
                        class="prose prose-zinc dark:prose-invert prose-sm prose-img:rounded-xl prose-img:max-w-xl w-full max-w-full"
                        v-html="item.description"
                    /> -->
                    <Markdown
                        v-if="item.description"
                        :content="item.description"
                        size="sm"
                        class="prose-img:rounded-xl prose-img:max-w-xl prose-h1:text-2xl w-full max-w-full"
                    />
                </div>
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
