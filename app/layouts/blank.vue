<script lang="ts" setup>
useHead({
    title: 'Avatio',
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [{ name: 'lang', content: 'ja' }],
});
</script>

<template>
    <div
        class="max-w-7xl min-h-screen mx-auto pt-6 px-6 lg:px-8 flex flex-col gap-6 md:gap-12 items-center"
    >
        <div class="w-full grid md:px-20 lg:px-32">
            <slot />
        </div>
    </div>
</template>
