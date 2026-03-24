<script setup lang="ts">
const { locale } = useI18n()
const { setupHide, setupUnhide } = useAppOverlay()

const { data: setups, refresh } = await useFetch('/api/admin/setups', {
    dedupe: 'defer',
})

const getMenuItems = (setup: NonNullable<typeof setups.value>[number]) => [
    [
        {
            to: `/setup/${setup.id}`,
            label: '閲覧',
            icon: 'mingcute:user-3-fill',
        },
    ],
    [
        {
            label: setup.hidAt ? '表示する' : '非表示にする',
            icon: setup.hidAt ? 'mingcute:eye-fill' : 'mingcute:eye-close-line',
            onSelect: async () => {
                if (setup.hidAt) setupUnhide.open({ setupId: setup.id })
                else setupHide.open({ setupId: setup.id })
                refresh()
            },
        },
    ],
]
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
                <UContextMenu v-for="setup in setups" :key="setup.id" :items="getMenuItems(setup)">
                    <div class="hover:bg-muted/50 flex items-center gap-2 rounded-md p-2">
                        <UAvatar
                            :src="setup.user.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                            size="xs"
                        />

                        <Icon
                            v-if="!setup.public"
                            name="mingcute:lock-fill"
                            size="14"
                            class="text-muted"
                        />

                        <p class="text-muted line-clamp-1 text-sm leading-none break-all">
                            {{ setup.name }}
                        </p>

                        <UBadge v-if="setup.hidAt" icon="mingcute:eye-close-line" variant="soft" />

                        <NuxtTime
                            :datetime="setup.createdAt"
                            relative
                            :locale
                            class="text-muted ml-auto text-xs leading-none text-nowrap"
                        />
                        <UTooltip v-if="setup.updatedAt !== setup.createdAt" :delay-duration="100">
                            <Icon name="mingcute:edit-3-fill" size="16" class="text-muted" />

                            <template #content>
                                <NuxtTime :datetime="setup.updatedAt" relative :locale />
                            </template>
                        </UTooltip>

                        <UDropdownMenu :items="getMenuItems(setup)">
                            <UButton icon="mingcute:more-2-line" variant="ghost" size="sm" />
                        </UDropdownMenu>
                    </div>
                </UContextMenu>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
