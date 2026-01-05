<script setup lang="ts">
const { getSession } = useAuth()
const session = await getSession()
</script>

<template>
    <div class="flex items-center gap-3">
        <NuxtLinkLocale to="/">
            <LogoAvatio class="w-24 sm:w-28" aria-label="Avatio" />
        </NuxtLinkLocale>

        <UButton
            v-if="session?.user.role === 'admin'"
            :to="$localePath('/admin')"
            label="admin"
            variant="subtle"
            size="xs"
            class="font-[Geist]"
        />
    </div>
</template>
