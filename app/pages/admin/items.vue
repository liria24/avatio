<script setup lang="ts">
const { locale } = useI18n()

const { data: items } = await useFetch('/api/admin/items', {
    dedupe: 'defer',
})

const getMenuItems = (item: NonNullable<typeof items.value>[number]) => [
    [
        {
            label: '閲覧',
            icon: 'mingcute:arrow-right-up-line',
        },
    ],
]
</script>

<template>
    <UDashboardPanel id="items">
        <template #header>
            <UDashboardNavbar title="Items" />
        </template>

        <template #body>
            <UPageList divide>
                <UContextMenu v-for="item in items" :key="item.id" :items="getMenuItems(item)">
                    <div class="hover:bg-muted/50 flex items-center gap-2 rounded-md p-2">
                        <p class="text-muted line-clamp-1 text-sm leading-none break-all">
                            {{ item.name }}
                        </p>

                        <NuxtTime
                            :datetime="item.createdAt"
                            relative
                            :locale
                            class="text-muted ml-auto text-xs leading-none text-nowrap"
                        />
                        <UTooltip v-if="item.updatedAt !== item.createdAt" :delay-duration="100">
                            <Icon name="mingcute:edit-3-fill" size="16" class="text-muted" />

                            <template #content>
                                <NuxtTime :datetime="item.updatedAt" relative :locale />
                            </template>
                        </UTooltip>

                        <UDropdownMenu :items="getMenuItems(item)">
                            <UButton icon="mingcute:more-2-line" variant="ghost" size="sm" />
                        </UDropdownMenu>
                    </div>
                </UContextMenu>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
