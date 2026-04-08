<script lang="ts" setup>
const { app } = useAppConfig()
const { session, revoke } = await useAuth()
const { getSummary } = useAdmin()

const { data: openCounts } = await getSummary()

const dev = import.meta.dev
const vercelEnv = process.env.NUXT_ENV_VERCEL_TARGET_ENV
</script>

<template>
    <div class="bg-elevated/70 fixed inset-0">
        <UDashboardGroup unit="rem" class="bg-default m-1 rounded-lg">
            <UDashboardSearch />

            <UDashboardSidebar
                id="default"
                collapsible
                resizable
                :ui="{
                    root: 'min-h-[calc(100svh-0.5rem)]',
                    footer: 'lg:border-t lg:border-default p-1',
                }"
            >
                <template #header="{ collapsed }">
                    <div :data-collapsed="collapsed" class="flex w-full items-center gap-2 pl-2">
                        <UButton
                            :to="$localePath('/admin')"
                            icon="avatio:avatio"
                            variant="link"
                            color="neutral"
                            class="text-highlighted gap-1.5 p-0 text-base font-extralight"
                        />

                        <UBadge
                            v-if="dev"
                            label="dev"
                            variant="soft"
                            size="sm"
                            class="ml-auto font-mono"
                        />
                        <UBadge
                            v-else-if="vercelEnv && vercelEnv !== 'production'"
                            :label="vercelEnv"
                            variant="soft"
                            size="sm"
                            class="ml-auto font-mono"
                        />
                    </div>
                </template>

                <template #default="{ collapsed }">
                    <UDashboardSearchButton
                        :kbds="[]"
                        variant="soft"
                        size="sm"
                        :ui="{ label: 'sr-only' }"
                    />

                    <UNavigationMenu
                        :collapsed
                        :items="[
                            {
                                label: 'Users',
                                icon: 'mingcute:group-2-fill',
                                to: '/admin/users',
                            },
                            {
                                label: 'Setups',
                                icon: 'mingcute:sparkles-fill',
                                to: '/admin/setups',
                            },
                            {
                                label: 'Items',
                                icon: 'mingcute:package-2-fill',
                                to: '/admin/items',
                            },
                            {
                                label: 'Changelogs',
                                icon: 'mingcute:cube-fill',
                                to: '/admin/changelogs',
                            },
                        ]"
                        orientation="vertical"
                        tooltip
                        popover
                        color="neutral"
                        :ui="{
                            link: 'gap-2.5 text-toned tracking-wide',
                            linkLeadingIcon: 'size-4.25 text-toned',
                        }"
                    />

                    <USeparator />

                    <UNavigationMenu
                        :collapsed
                        :items="[
                            {
                                label: 'Feedbacks',
                                icon: 'mingcute:chat-3-fill',
                                to: '/admin/feedbacks',
                                badge: openCounts?.feedbackOpenCount || undefined,
                            },
                            {
                                label: 'Reports',
                                icon: 'mingcute:flag-3-fill',
                                to: '/admin/reports',
                                badge: openCounts?.reportOpenCount || undefined,
                            },
                            {
                                label: 'Emails',
                                icon: 'mingcute:mail-fill',
                                to: '/admin/emails',
                            },
                        ]"
                        orientation="vertical"
                        tooltip
                        popover
                        color="neutral"
                        :ui="{
                            link: 'gap-2.5 text-toned tracking-wide',
                            linkLeadingIcon: 'size-4.25 text-toned',
                        }"
                    />

                    <USeparator />

                    <UNavigationMenu
                        :collapsed
                        :items="[
                            {
                                label: 'Audit Logs',
                                icon: 'mingcute:terminal-box-fill',
                                to: '/admin/audit-logs',
                            },
                        ]"
                        orientation="vertical"
                        tooltip
                        popover
                        color="neutral"
                        :ui="{
                            link: 'gap-2.5 text-toned tracking-wide',
                            linkLeadingIcon: 'size-4.25 text-toned',
                        }"
                    />

                    <div class="mt-auto flex items-center px-1">
                        <UButton
                            :to="$localePath('/')"
                            aria-label="Back to Site"
                            icon="mingcute:arrow-left-line"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            class="mr-auto"
                        />
                        <UButton
                            :to="app.liria.twitter"
                            target="_blank"
                            external
                            aria-label="X/Twitter"
                            icon="mingcute:social-x-fill"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                        />
                        <UButton
                            :to="app.repo"
                            target="_blank"
                            external
                            aria-label="GitHub"
                            icon="mingcute:github-fill"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                        />
                    </div>
                </template>

                <template #footer="{ collapsed }">
                    <UDropdownMenu
                        :content="{
                            align: 'start',
                            side: 'right',
                        }"
                        :items="[
                            {
                                to: '/settings',
                                label: 'Settings',
                                icon: 'mingcute:settings-1-fill',
                            },
                            {
                                label: 'Logout',
                                icon: 'mingcute:exit-fill',
                                onClick: () => revoke(),
                            },
                        ]"
                    >
                        <button
                            type="button"
                            class="hover:bg-muted w-full cursor-pointer rounded-lg p-2"
                        >
                            <UAvatar
                                v-if="collapsed"
                                :src="session?.user.image || undefined"
                                :alt="session?.user.name || undefined"
                                icon="lucide:user-round"
                                size="sm"
                            />
                            <UUser
                                v-else
                                :name="session?.user.name || undefined"
                                :description="session?.user.email || undefined"
                                :avatar="{
                                    src: session?.user.image || undefined,
                                    alt: session?.user.name || undefined,
                                    icon: 'lucide:user-round',
                                }"
                                size="sm"
                                class="text-left"
                            />
                        </button>
                    </UDropdownMenu>
                </template>
            </UDashboardSidebar>

            <main class="@container min-h-dvh w-full">
                <slot />
            </main>
        </UDashboardGroup>
    </div>
</template>
