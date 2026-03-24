<script lang="ts" setup>
const { app } = useAppConfig()
const { session, revoke } = await useAuth()

const dev = import.meta.dev
const vercelEnv = process.env.NUXT_ENV_VERCEL_TARGET_ENV
</script>

<template>
    <div class="bg-elevated/70 fixed inset-0">
        <UDashboardGroup unit="rem" class="bg-default m-1 rounded-lg">
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
                            label="Admin"
                            variant="link"
                            color="neutral"
                            size="sm"
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

                    <div class="grid gap-1">
                        <span
                            class="text-muted pl-2 font-mono text-[0.8rem] leading-none text-nowrap"
                        >
                            Reports
                        </span>

                        <UNavigationMenu
                            :collapsed
                            :items="[
                                {
                                    label: 'Feedbacks',
                                    icon: 'mingcute:chat-3-fill',
                                    to: '/admin/feedbacks',
                                },
                                {
                                    label: 'Reports',
                                    icon: 'mingcute:flag-3-fill',
                                    to: '/admin/reports',
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
                    </div>

                    <div class="grid gap-1">
                        <span
                            class="text-muted pl-2 font-mono text-[0.8rem] leading-none text-nowrap"
                        >
                            Observability
                        </span>

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
                    </div>

                    <UNavigationMenu
                        :collapsed
                        :items="[
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
                            {
                                to: $localePath('/'),
                                label: 'Back to Site',
                                icon: 'mingcute:arrow-left-line',
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
                        class="mt-auto"
                    />
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

            <main class="min-h-dvh w-full overflow-auto">
                <slot />
            </main>
        </UDashboardGroup>
    </div>
</template>
