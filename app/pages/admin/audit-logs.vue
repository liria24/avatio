<script lang="ts" setup>
const auditLogAttributes: Record<
    AuditActionType,
    {
        icon: string
        label: string
        color: 'primary' | 'success' | 'error' | 'info' | 'secondary' | 'warning' | 'neutral'
    }
> = {
    user_ban: {
        icon: 'mingcute:forbid-circle-fill',
        label: 'Banned user',
        color: 'error',
    },
    user_unban: {
        icon: 'mingcute:back-fill',
        label: 'Unbanned user',
        color: 'info',
    },
    user_delete: {
        icon: 'mingcute:user-x-fill',
        label: 'Deleted user',
        color: 'error',
    },
    user_role_change: {
        icon: 'mingcute:user-security-fill',
        label: 'Changed user role',
        color: 'info',
    },
    user_shop_verify: {
        icon: 'mingcute:store-fill',
        label: 'Verified user shop',
        color: 'success',
    },
    user_shop_unverify: {
        icon: 'mingcute:close-circle-fill',
        label: 'Unverified user shop',
        color: 'error',
    },
    user_badge_grant: {
        icon: 'mingcute:award-fill',
        label: 'Granted user badge',
        color: 'success',
    },
    user_badge_revoke: {
        icon: 'mingcute:award-fill',
        label: 'Revoked user badge',
        color: 'error',
    },
    setup_hide: {
        icon: 'mingcute:eye-close-fill',
        label: 'Hidden setup',
        color: 'secondary',
    },
    setup_unhide: {
        icon: 'mingcute:eye-2-fill',
        label: 'Unhidden setup',
        color: 'secondary',
    },
    setup_delete: {
        icon: 'mingcute:delete-2-fill',
        label: 'Deleted setup',
        color: 'error',
    },
    report_resolve: {
        icon: 'mingcute:check-circle-fill',
        label: 'Resolved report',
        color: 'success',
    },
    feedback_close: {
        icon: 'mingcute:forbid-circle-fill',
        label: 'Closed feedback',
        color: 'success',
    },
    cleanup: {
        icon: 'mingcute:delete-2-fill',
        label: 'Performed cleanup',
        color: 'info',
    },
}

const { data, refresh } = await useFetch('/api/admin/audit-log', {
    dedupe: 'defer',
    transform: (res) => ({
        data: Object.entries(
            res.data.reduce(
                (groups, log) => {
                    const date = new Date(log.createdAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                    })
                    ;(groups[date] ??= []).push(log)
                    return groups
                },
                {} as Record<string, typeof res.data>,
            ),
        ).map(([date, items]) => ({ date, items })),
        pagination: res.pagination,
    }),
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

useSeo({
    title: 'Admin - Audit Logs',
})
</script>

<template>
    <UDashboardPanel id="audit-logs">
        <template #header>
            <UDashboardNavbar title="Audit Logs">
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
            <UPageList>
                <template v-for="group in data.data" :key="`group-${group.date}`">
                    <div class="p-1 font-mono text-xs">
                        {{ group.date }}
                    </div>

                    <div
                        v-for="log in group.items"
                        :key="`log-${log.id}`"
                        class="odd:bg-muted/50 text-toned flex items-center gap-3 p-1 font-mono text-xs"
                    >
                        <NuxtTime
                            :datetime="log.createdAt"
                            time-style="medium"
                            class="text-muted"
                        />

                        <NuxtLink v-if="log.user" :to="`/@${log.user.username}`">
                            <UAvatar
                                :src="log.user.image || undefined"
                                :alt="log.user.name"
                                icon="mingcute:user-3-fill"
                                size="3xs"
                            />
                        </NuxtLink>

                        <span> {{ auditLogAttributes[log.action].label }}: </span>

                        <p>{{ log.details }}</p>
                    </div>
                </template>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
