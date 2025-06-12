<script lang="ts" setup>
useHead({
    title: 'Avatio',
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [{ name: 'lang', content: 'ja' }],
})
</script>

<template>
    <div
        class="mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-6 px-6 pt-6 md:gap-12 lg:px-8"
    >
        <div class="grid w-full md:px-20 lg:px-32">
            <slot />
        </div>
    </div>
</template>
