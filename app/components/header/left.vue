<script setup lang="ts">
const { app } = useAppConfig()
const { session } = useAuth()

const dev = import.meta.dev
</script>

<template>
    <div class="flex items-center gap-1.5">
        <NuxtLinkLocale to="/">
            <AppLogo class="-mt-1.5 w-24 sm:w-28" aria-label="Avatio" />
        </NuxtLinkLocale>

        <UButton
            :to="$localePath('/changelogs')"
            :prefetch="!dev"
            :label="`v${app.version}`"
            variant="soft"
            color="neutral"
            size="xs"
            class="hidden rounded-full px-3 sm:inline-flex"
        />

        <UButton
            v-if="session?.user.role === 'admin'"
            :to="$localePath('/admin')"
            :label="$t('admin.label')"
            variant="subtle"
            size="xs"
            class="hidden font-mono sm:inline-flex"
        />
    </div>
</template>
