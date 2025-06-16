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
                <Button
                    label="最新"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'latest' ? 'bg-zinc-200 dark:bg-zinc-700' : '',
                    ]"
                    @click="mode = 'latest'"
                />
                <Button
                    label="自分の投稿"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'user' ? 'bg-zinc-200 dark:bg-zinc-700' : '',
                    ]"
                    @click="mode = 'user'"
                />
                <Button
                    label="ブックマーク"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'bookmarks'
                            ? 'bg-zinc-200 dark:bg-zinc-700'
                            : '',
                    ]"
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
