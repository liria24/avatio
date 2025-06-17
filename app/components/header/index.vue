<script setup lang="ts">
// const route = useRoute()
// const excludePath = ['/setup/compose']
</script>

<template>
    <header class="flex w-full items-center justify-between gap-6">
        <div class="flex w-full items-center gap-x-4 gap-y-2">
            <NuxtLinkLocale to="/">
                <LogoAvatio class="w-24 sm:w-32" aria-label="Avatio" />
            </NuxtLinkLocale>

            <!-- <BannerHeader
                v-if="!excludePath.includes(route.path)"
                class="hidden sm:flex"
            /> -->
        </div>
        <HeaderMenu />
    </header>
</template>
