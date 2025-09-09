<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui'

const { $session } = useNuxtApp()
const session = await $session()

const title = 'Avatio'

const { data } = await useFetch('/api/admin/stats', {
    key: 'admin-stats',
    dedupe: 'defer',
    default: () => ({
        users: 0,
        setups: 0,
        items: 0,
        feedbacks: 0,
        itemReports: 0,
        setupReports: 0,
        userReports: 0,
    }),
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause !== 'initial'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const links = [
    [
        {
            label: 'Home',
            icon: 'lucide:house',
            to: '/admin',
        },
        {
            label: 'Users',
            icon: 'lucide:users-round',
            to: '/admin/users',
            badge: data.value.users,
        },
        {
            label: 'Setups',
            icon: 'lucide:sparkles',
            to: '/admin/setups',
            badge: data.value.setups,
        },
        {
            label: 'Items',
            icon: 'lucide:package',
            to: '/admin/items',
            badge: data.value.items,
        },
        {
            label: 'Feedbacks',
            icon: 'lucide:message-square',
            to: '/admin/feedbacks',
            badge: data.value.feedbacks,
        },
        {
            label: 'Reports',
            icon: 'lucide:flag',
            defaultOpen: true,
            type: 'trigger',
            children: [
                {
                    label: 'Item',
                    icon: 'lucide:package',
                    to: '/admin/reports/item',
                    badge: data.value.itemReports,
                },
                {
                    label: 'Setup',
                    icon: 'lucide:sparkles',
                    to: '/admin/reports/setup',
                    badge: data.value.setupReports,
                },
                {
                    label: 'User',
                    icon: 'lucide:user-round',
                    to: '/admin/reports/user',
                    badge: data.value.userReports,
                },
            ],
        },
        {
            label: 'Changelogs',
            icon: 'lucide:blocks',
            to: '/admin/changelogs',
        },
        {
            label: 'Audit Logs',
            icon: 'lucide:logs',
            to: '/admin/audit-logs',
        },
    ],
    [
        {
            label: 'X/Twitter',
            icon: 'simple-icons:x',
            to: 'https://x.com/liria_24',
            target: '_blank',
        },
        {
            label: 'GitHub',
            icon: 'simple-icons:github',
            to: 'https://github.com/liria24/avatio',
            target: '_blank',
        },
    ],
] satisfies NavigationMenuItem[][]
</script>

<template>
    <Html>
        <Head>
            <Title>{{ title }}</Title>
        </Head>

        <Body>
            <UMain>
                <UDashboardGroup unit="rem" class="font-[Geist]">
                    <UDashboardSidebar
                        id="default"
                        collapsible
                        resizable
                        class="bg-elevated/25"
                        :ui="{ footer: 'lg:border-t lg:border-default' }"
                    >
                        <template #header="{ collapsed }">
                            <div
                                :data-collapsed="collapsed"
                                class="flex w-full items-center justify-between gap-2 pl-2 data-[collapsed=true]:flex-col data-[collapsed=true]:pt-5 data-[collapsed=true]:pl-0"
                            >
                                <NuxtLink to="/">
                                    <Icon name="avatio:avatio" size="24" />
                                </NuxtLink>

                                <UDashboardSidebarCollapse />
                            </div>
                        </template>

                        <template #default="{ collapsed }">
                            <UNavigationMenu
                                :collapsed="collapsed"
                                :items="links[0]"
                                orientation="vertical"
                                tooltip
                                popover
                            />

                            <UNavigationMenu
                                :collapsed="collapsed"
                                :items="links[1]"
                                orientation="vertical"
                                tooltip
                                class="mt-auto"
                            />
                        </template>

                        <template #footer>
                            <UUser
                                :name="session?.user.name"
                                :description="`@${session?.user.id}`"
                                :avatar="{
                                    src: session?.user.image || undefined,
                                    icon: 'lucide:user-round',
                                }"
                            />
                        </template>
                    </UDashboardSidebar>

                    <slot />
                </UDashboardGroup>
            </UMain>
        </Body>
    </Html>
</template>
