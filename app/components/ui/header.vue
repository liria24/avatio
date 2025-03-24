<script setup lang="ts">
const route = useRoute();
const excludePath = ['/setup/compose'];
</script>

<template>
    <header class="flex items-center gap-6 justify-between w-full">
        <div class="w-full flex items-center gap-x-4 gap-y-2">
            <NuxtLink to="/">
                <LogoAvatio class="w-24 sm:w-32" aria-label="Avatio" />
            </NuxtLink>

            <BannerHeader v-if="!excludePath.includes(route.path)" />
        </div>
        <UiHeaderMenu />
    </header>
</template>
