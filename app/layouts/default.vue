<script lang="ts" setup>
const route = useRoute();
const paddingExclude = ['/', '/release', '/setup/compose'];
const footerExclude = ['/setup/compose'];

useHead({
    title: 'Avatio',
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [{ name: 'lang', content: 'ja' }],
});
</script>

<template>
    <div
        class="max-w-7xl min-h-screen mx-auto pt-6 px-6 lg:px-8 flex flex-col gap-6 md:gap-8 items-center"
    >
        <UiHeader />
        <div
            class="hidden noscript:flex justify-center items-center w-full p-4 ring-2 ring-red-500 bg-red-100 text-red-800 rounded-xl text-sm"
        >
            この Web サイトは JavaScript を使用しています。<br />
            JavaScript が無効の場合、正しく表示されません。
        </div>
        <div
            :class="[
                'w-full grow grid',
                paddingExclude.includes(route.path)
                    ? 'px-4'
                    : 'md:px-20 lg:px-32',
            ]"
        >
            <slot />
        </div>
        <UiFooter v-if="!footerExclude.includes(route.path)" />
    </div>
</template>
