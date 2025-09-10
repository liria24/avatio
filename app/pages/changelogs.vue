<script setup lang="ts">
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
        getCachedData: (key, nuxtApp, ctx) =>
            ctx.cause === 'refresh:manual'
                ? undefined
                : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    }
)

const versions = computed(() => {
    return data.value.data.map((item) => ({
        title: item.title,
        description: '',
        date: item.createdAt,
        content: item.markdown,
    }))
})

defineSeo({
    title: '変更履歴',
    description: 'Avatio の変更履歴を確認できます。',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">変更履歴</h1>

        <UChangelogVersions>
            <UChangelogVersion
                v-for="(version, index) in versions"
                :key="index"
                v-bind="version"
                :ui="{ container: 'ml-40 mr-0 max-w-full', title: 'text-3xl' }"
            >
                <template #description>
                    <MDC
                        v-if="version.content"
                        :value="useLineBreak(version.content)"
                        class="w-full max-w-full wrap-anywhere break-keep"
                    />
                </template>
            </UChangelogVersion>
        </UChangelogVersions>
    </div>
</template>
