<script setup lang="ts">
const { session } = useAuth()
</script>

<template>
    <div class="flex items-center gap-3">
        <NuxtLinkLocale to="/">
            <LogoAvatio class="w-24 sm:w-28" aria-label="Avatio" />
        </NuxtLinkLocale>

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
