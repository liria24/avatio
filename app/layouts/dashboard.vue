<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui'

const { app } = useAppConfig()
const { getSession } = useAuth()
const session = await getSession()

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
        ctx.cause !== 'initial' ? undefined : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const links = [
    [
        {
            label: 'Home',
            icon: 'mingcute:home-3-fill',
            to: '/admin',
        },
        {
            label: 'Users',
            icon: 'mingcute:group-2-fill',
            to: '/admin/users',
            badge: data.value.users,
        },
        {
            label: 'Setups',
            icon: 'mingcute:sparkles-fill',
            to: '/admin/setups',
            badge: data.value.setups,
        },
        {
            label: 'Items',
            icon: 'mingcute:package-2-fill',
            to: '/admin/items',
            badge: data.value.items,
        },
        {
            label: 'Feedbacks',
            icon: 'mingcute:chat-3-fill',
            to: '/admin/feedbacks',
            badge: data.value.feedbacks,
        },
        {
            label: 'Reports',
            icon: 'mingcute:flag-3-fill',
            defaultOpen: true,
            type: 'trigger',
            children: [
                {
                    label: 'Item',
                    icon: 'mingcute:package-2-fill',
                    to: '/admin/reports/item',
                    badge: data.value.itemReports,
                },
                {
                    label: 'Setup',
                    icon: 'mingcute:sparkles-fill',
                    to: '/admin/reports/setup',
                    badge: data.value.setupReports,
                },
                {
                    label: 'User',
                    icon: 'mingcute:user-3-fill',
                    to: '/admin/reports/user',
                    badge: data.value.userReports,
                },
            ],
        },
        {
            label: 'Changelogs',
            icon: 'mingcute:cube-fill',
            to: '/admin/changelogs',
        },
        {
            label: 'Audit Logs',
            icon: 'mingcute:terminal-box-fill',
            to: '/admin/audit-logs',
        },
    ],
    [
        {
            label: 'X/Twitter',
            icon: 'mingcute:social-x-fill',
            to: app.liria.twitter,
            target: '_blank',
        },
        {
            label: 'GitHub',
            icon: 'mingcute:github-fill',
            to: app.repo,
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
                                :description="`@${session?.user.username}`"
                                :avatar="{
                                    src: session?.user.image || undefined,
                                    icon: 'mingcute:user-3-fill',
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
