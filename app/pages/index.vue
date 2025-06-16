<script setup lang="ts">
const user = useSupabaseUser()

const mode = ref<'latest' | 'user' | 'bookmarks'>('latest')

const setupsPerPage: number = 50
const page = ref(0)

const { setups, hasMore, status, fetchMoreSetups } = useFetchSetups(mode, {
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
        userId: user.value?.id || null,
    })),
})

defineSeo({
    type: 'website',
    title: 'Avatio',
    titleTemplate: '%s',
    description: 'あなたのアバター改変を共有しよう',
    image: 'https://avatio.me/ogp_2.png',
})
useSchemaOrg([
    defineWebSite({
        name: 'Avatio',
        description: 'あなたのアバター改変を共有しよう',
        inLanguage: 'ja-JP',
        potentialAction: defineSearchAction({
            target: '/search?q={search_term_string}',
        }),
    }),
])
</script>

<template>
    <div class="flex w-full flex-col gap-6">
        <BannerHeader class="flex sm:hidden" />

        <Hero v-if="!user" class="sm:mt-12 sm:mb-6" />

        <div v-if="user" class="flex w-full flex-col items-start gap-5">
            <UiTitle label="ホーム" size="lg" />
            <div class="flex flex-wrap items-center gap-1">
                <UButton
                    label="最新"
                    :variant="mode === 'latest' ? 'solid' : 'ghost'"
                    @click="mode = 'latest'"
                />
                <UButton
                    label="自分の投稿"
                    :variant="mode === 'user' ? 'solid' : 'ghost'"
                    @click="mode = 'user'"
                />
                <UButton
                    label="ブックマーク"
                    :variant="mode === 'bookmarks' ? 'solid' : 'ghost'"
                    @click="mode = 'bookmarks'"
                />
            </div>
            <div class="flex w-full flex-col gap-3 self-center">
                <SetupsList :setups="setups" :loading="status === 'pending'" />
                <ButtonLoadMore
                    v-if="hasMore"
                    :loading="status === 'pending'"
                    class="w-full"
                    @click="fetchMoreSetups"
                />
            </div>
        </div>

        <div v-else class="flex w-full flex-col gap-3 self-center">
            <SetupsList :setups="setups" :loading="status === 'pending'" />
            <ButtonLoadMore
                v-if="hasMore"
                :loading="status === 'pending'"
                class="w-full"
                @click="fetchMoreSetups"
            />
        </div>
    </div>
</template>
