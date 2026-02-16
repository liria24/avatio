<script setup lang="ts">
const { app } = useAppConfig()
const { session } = useAuth()
</script>

<template>
    <div class="flex items-center gap-1.5">
        <NuxtLinkLocale to="/">
            <LogoAvatio class="-mt-1.5 w-24 sm:w-28" aria-label="Avatio" />
        </NuxtLinkLocale>

        <UButton
            :to="$localePath('/changelogs')"
            :label="`v${app.version}`"
            variant="soft"
            color="neutral"
            size="xs"
            class="rounded-full px-3"
        />

        <UButton
            v-if="session?.user.role === 'admin'"
            :to="$localePath('/admin')"
            :label="$t('admin.label')"
            variant="subtle"
            size="xs"
            class="font-mono"
        />
    </div>
</template>
