<script lang="ts" setup>
const route = useRoute()
const paddingExclude = ['/', '/release', '/setup/compose']
const footerExclude = ['/setup/compose']

useHead({
    title: 'Avatio',
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [{ name: 'lang', content: 'ja' }],
})
</script>

<template>
    <Html lang="ja">
        <Head>
            <Title>Avatio</Title>
            <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            <Meta name="lang" content="ja" />
        </Head>
        <Body>
            <div
                class="mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-6 px-6 pt-6 md:gap-8 lg:px-8"
            >
                <UiHeader />
                <div
                    class="hidden w-full items-center justify-center rounded-xl bg-red-100 p-4 text-sm text-red-800 ring-2 ring-red-500 noscript:flex"
                >
                    この Web サイトは JavaScript を使用しています。<br />
                    JavaScript が無効の場合、正しく表示されません。
                </div>
                <main
                    :class="[
                        'grid w-full grow',
                        paddingExclude.includes(route.path)
                            ? 'px-4'
                            : 'md:px-20 lg:px-32',
                    ]"
                >
                    <slot />
                </main>
                <UiFooter v-if="!footerExclude.includes(route.path)" />
            </div>
        </Body>
    </Html>
</template>
