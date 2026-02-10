<script lang="ts" setup>
const { getSession } = useAuth()
const session = await getSession()
const colorMode = useColorMode()
</script>

<template>
    <UContainer class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8">
        <header class="flex w-full items-center justify-between gap-6">
            <HeaderLeft />

            <HeaderThemeButton v-if="!session" />
        </header>

        <main class="grid w-full grow">
            <slot />
        </main>
    </UContainer>
</template>
