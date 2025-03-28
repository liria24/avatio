<script setup lang="ts">
const user = useSupabaseUser();

const mode = ref<'all' | 'mine' | 'bookmark'>('all');

useOGP({
    url: 'https://avatio.me',
    type: 'website',
    title: 'Avatio',
    titleTemplate: '%s',
    description: 'あなたのアバター改変を共有しよう',
    image: 'https://avatio.me/ogp_2.png',
    twitterCard: 'summary_large_image',
});
</script>

<template>
    <div class="w-full flex flex-col gap-6">
        <BannerHeader class="flex sm:hidden" />

        <Hero v-if="!user" class="sm:mt-12 sm:mb-6" />

        <div v-if="user" class="flex flex-col items-start gap-5 w-full">
            <UiTitle label="ホーム" size="lg" />
            <div class="flex flex-wrap items-center gap-1">
                <Button
                    label="最新"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'all' ? 'bg-zinc-200 dark:bg-zinc-700' : '',
                    ]"
                    @click="mode = 'all'"
                />
                <Button
                    label="自分の投稿"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'mine' ? 'bg-zinc-200 dark:bg-zinc-700' : '',
                    ]"
                    @click="mode = 'mine'"
                />
                <Button
                    label="ブックマーク"
                    variant="flat"
                    :class="[
                        'text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700',
                        mode === 'bookmark'
                            ? 'bg-zinc-200 dark:bg-zinc-700'
                            : '',
                    ]"
                    @click="mode = 'bookmark'"
                />
            </div>

            <SetupsListHome v-if="mode === 'all'" />
            <SetupsListUser
                v-else-if="mode === 'mine'"
                :user-id="user ? user.id : null"
            />
            <SetupsListBookmarks v-else-if="mode === 'bookmark'" />
        </div>

        <SetupsListHome v-else />
    </div>
</template>
