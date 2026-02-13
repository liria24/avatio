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
                        icon="mingcute:refresh-2-line"
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
                        <div class="flex items-center gap-1">
                            <span class="font-medium">
                                {{ changelog.title }}
                            </span>

                            <NuxtTime
                                :datetime="changelog.createdAt"
                                relative
                                :locale
                                class="text-muted mr-1 ml-auto text-sm"
                            />
                            <UModal
                                scrollable
                                :ui="{ content: 'max-w-3xl p-8 flex flex-col gap-6 divide-y-0' }"
                            >
                                <UButton icon="mingcute:eye-2-fill" variant="soft" size="sm" />

                                <template #content>
                                    <h1 class="text-3xl font-bold">{{ changelog.title }}</h1>

                                    <USeparator />

                                    <LazyMDC
                                        :value="changelog.markdown"
                                        :parser-options="{
                                            toc: false,
                                            contentHeading: false,
                                        }"
                                        class="sentence w-full max-w-full *:first:mt-0 *:last:mb-0"
                                    />
                                </template>
                            </UModal>

                            <!-- <UButton
                                :to="
                                    $localePath(`/admin/changelogs/compose?slug=${changelog.slug}`)
                                "
                                icon="mingcute:edit-2-fill"
                                variant="soft"
                                size="sm"
                            /> -->
                        </div>
                    </template>
                </UCard>
            </div>
        </template>
    </UDashboardPanel>
</template>
