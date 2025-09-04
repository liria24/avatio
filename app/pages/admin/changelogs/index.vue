<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

const nuxtApp = useNuxtApp()

const { data, status, refresh } = await useFetch('/api/changelogs', {
    dedupe: 'defer',
    headers:
        import.meta.server && nuxtApp.ssrContext?.event.headers
            ? nuxtApp.ssrContext.event.headers
            : undefined,
    default: () => ({
        data: [],
        pagination: {
            page: 1,
            limit: 0,
            total: 0,
            totalPages: 0,
            hasPrev: false,
            hasNext: false,
        },
    }),
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause !== 'initial'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})
</script>

<template>
    <UDashboardPanel id="changelogs">
        <template #header>
            <UDashboardNavbar title="Changelogs">
                <template #right>
                    <UButton
                        to="/admin/changelogs/compose"
                        icon="lucide:plus"
                        label="New Changelog"
                        color="neutral"
                    />

                    <UButton
                        :loading="status === 'pending'"
                        icon="lucide:refresh-cw"
                        variant="soft"
                        color="neutral"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div v-for="changelog in data.data" :key="changelog.slug">
                {{ changelog }}
            </div>
        </template>
    </UDashboardPanel>
</template>
