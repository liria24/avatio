<script setup lang="ts">
const { app } = useAppConfig()
const { user } = useUserSession()
</script>

<template>
    <div class="flex items-center gap-1.5">
        <NuxtLinkLocale :to="{ path: '/' }">
            <AppLogo class="-mt-1.5 w-24 sm:w-28" aria-label="Avatio" />
        </NuxtLinkLocale>

        <UButton
            :to="$localePath({ path: '/changelogs' })"
            :label="`v${app.version}`"
            variant="soft"
            color="neutral"
            size="xs"
            class="hidden rounded-full px-3 sm:inline-flex"
        />

        <UButton
            v-if="user?.role === 'admin'"
            :to="$localePath({ path: '/admin' })"
            :label="$t('admin.label')"
            variant="subtle"
            size="xs"
            class="hidden font-mono sm:inline-flex"
        />
    </div>
</template>
