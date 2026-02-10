<script setup lang="ts">
const { locale } = useI18n()

const { data: setups, refresh } = await useFetch('/api/setups', {
    query: {
        limit: 1000,
    },
    dedupe: 'defer',
})
</script>

<template>
    <UDashboardPanel id="setups">
        <template #header>
            <UDashboardNavbar title="Setups">
                <template #trailing>
                    <UButton
                        loading-auto
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageList divide>
                <div
                    v-for="setup in setups?.data"
                    :key="setup.id"
                    class="hover:bg-muted/50 flex items-center gap-3 rounded-md p-2"
                >
                    <div class="flex grow items-center gap-2">
                        <p class="text-muted line-clamp-1 text-sm leading-none break-all">
                            {{ setup.name }}
                        </p>
                    </div>

                    <NuxtTime
                        :datetime="setup.createdAt"
                        relative
                        :locale
                        class="text-muted text-xs leading-none text-nowrap"
                    />
                    <p
                        v-if="setup.updatedAt !== setup.createdAt"
                        class="text-muted text-xs leading-none text-nowrap"
                    >
                        (
                        <NuxtTime :datetime="setup.updatedAt" relative :locale />
                        {{ $t('admin.users.updated') }})
                    </p>
                </div>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
