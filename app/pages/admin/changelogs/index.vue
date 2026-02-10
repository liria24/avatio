<script setup lang="ts">
const { locale } = useI18n()

const { data, status, refresh } = await useFetch('/api/changelogs', {
    dedupe: 'defer',
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
})
</script>

<template>
    <UDashboardPanel id="changelogs">
        <template #header>
            <UDashboardNavbar title="Changelogs">
                <template #right>
                    <UButton
                        :to="$localePath('/admin/changelogs/compose')"
                        icon="mingcute:add-line"
                        label="New Changelog"
                        color="neutral"
                    />

                    <UButton
                        :loading="status === 'pending'"
                        icon="mingcute:refresh-2-fill"
                        variant="soft"
                        color="neutral"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex flex-col gap-4">
                <UCard v-for="changelog in data.data" :key="changelog.slug">
                    <template #header>
                        <div class="flex items-center justify-between gap-3">
                            <span class="font-medium">
                                {{ changelog.title }}
                            </span>

                            <NuxtTime
                                :datetime="changelog.createdAt"
                                relative
                                :locale
                                class="text-muted text-sm"
                            />
                        </div>
                    </template>

                    <UCollapsible class="flex flex-col gap-2">
                        <UButton
                            label="Markdown"
                            color="neutral"
                            variant="soft"
                            trailing-icon="i-lucide-chevron-down"
                            block
                        />

                        <template #content>
                            <MDC :value="changelog.markdown" class="w-full max-w-full" />
                        </template>
                    </UCollapsible>
                </UCard>
            </div>
        </template>
    </UDashboardPanel>
</template>
