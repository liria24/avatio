<script setup lang="ts">
import type { ComarkTree } from 'comark'
import type { FetchResult } from 'nuxt/app'

const { t, locale, localeProperties } = useI18n()

type ChangelogItem = NonNullable<FetchResult<'/api/changelogs', 'get'>>['data'][number]

const page = ref(1)
const changelogList = ref<ChangelogItem[]>([])

const { data, status, refresh } = await useFetch('/api/changelogs', {
    key: computed(() => `changelogs-${locale.value}-${page.value}`),
    query: computed(() => ({ lang: locale.value, page: page.value })),
    dedupe: 'defer',
})

watchImmediate(data, (newData) => {
    if (newData?.data) {
        if (page.value === 1) changelogList.value = newData.data
        // @ts-expect-error - TypeScript cannot infer that `changelogList.value` is already an array of `ChangelogItem` at this point, but it should work as expected.
        else changelogList.value = [...changelogList.value, ...newData.data]
    }
})

const pagination = computed(() => data.value?.pagination)

watch(locale, () => {
    page.value = 1
    refresh()
})

const loadMore = async () => {
    if (pagination.value?.hasNext) {
        page.value += 1
        await refresh()
    }
}

useSeo({
    title: t('changelogs.title'),
    description: t('changelogs.description'),
    image: {
        component: 'General.takumi',
        props: {
            title: t('changelogs.title'),
            description: t('changelogs.description'),
        },
    },
    twitterCard: 'summary_large_image',
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">{{ $t('changelogs.title') }}</h1>

        <UChangelogVersions>
            <UChangelogVersion
                v-for="(changelog, index) in changelogList"
                :key="index"
                :title="changelog.title"
                :date="changelog.createdAt"
                :ui="{
                    container: 'lg:ml-40 mr-0 max-w-full',
                    title: 'sentence text-3xl font-bold before:text-muted before:font-[Geist] before:tracking-tight before:font-light before:content-[\'//_\']',
                    description: 'flex flex-col items-start gap-5 mt-5',
                }"
            >
                <template #description>
                    <USeparator />
                    <UBadge
                        v-if="changelog.fallbacked"
                        :label="$t('changelogs.fallbacked', { locale: localeProperties.name })"
                        variant="soft"
                    />
                    <ComarkRenderer
                        v-if="changelog.tree"
                        :tree="changelog.tree as ComarkTree"
                        class="sentence w-full max-w-full whitespace-pre-wrap *:first:mt-0 *:last:mb-0 [&_img]:max-w-lg"
                    />
                    <UBadge
                        v-if="changelog.aiGenerated"
                        icon="mingcute:translate-2-ai-line"
                        :label="$t('changelogs.translatedByAi')"
                        variant="soft"
                    />
                </template>
            </UChangelogVersion>
        </UChangelogVersions>

        <UButton
            v-if="pagination?.hasNext"
            :loading="status === 'pending'"
            :label="$t('more')"
            variant="outline"
            color="neutral"
            class="mx-auto rounded-lg px-4 py-2"
            @click="loadMore"
        />
    </div>
</template>
