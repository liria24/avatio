<script lang="ts" setup>
const { locale, t } = useI18n()

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
        label: t('admin.auditLogs.userBan'),
        color: 'error',
    },
    user_unban: {
        icon: 'mingcute:back-fill',
        label: t('admin.auditLogs.userUnban'),
        color: 'info',
    },
    user_delete: {
        icon: 'mingcute:user-x-fill',
        label: t('admin.auditLogs.userDelete'),
        color: 'error',
    },
    user_role_change: {
        icon: 'mingcute:user-security-fill',
        label: t('admin.auditLogs.userRoleChange'),
        color: 'info',
    },
    user_shop_verify: {
        icon: 'mingcute:store-fill',
        label: t('admin.auditLogs.userShopVerify'),
        color: 'success',
    },
    user_shop_unverify: {
        icon: 'mingcute:close-circle-fill',
        label: t('admin.auditLogs.userShopUnverify'),
        color: 'error',
    },
    user_badge_grant: {
        icon: 'mingcute:award-fill',
        label: t('admin.auditLogs.userBadgeGrant'),
        color: 'success',
    },
    user_badge_revoke: {
        icon: 'mingcute:award-fill',
        label: t('admin.auditLogs.userBadgeRevoke'),
        color: 'error',
    },
    setup_hide: {
        icon: 'mingcute:eye-close-fill',
        label: t('admin.auditLogs.setupHide'),
        color: 'secondary',
    },
    setup_unhide: {
        icon: 'mingcute:eye-2-fill',
        label: t('admin.auditLogs.setupUnhide'),
        color: 'secondary',
    },
    setup_delete: {
        icon: 'mingcute:delete-2-fill',
        label: t('admin.auditLogs.setupDelete'),
        color: 'error',
    },
    report_resolve: {
        icon: 'mingcute:check-circle-fill',
        label: t('admin.auditLogs.reportResolve'),
        color: 'success',
    },
    feedback_close: {
        icon: 'mingcute:forbid-circle-fill',
        label: t('admin.auditLogs.feedbackClose'),
        color: 'success',
    },
    cleanup: {
        icon: 'mingcute:delete-2-fill',
        label: t('admin.auditLogs.cleanup'),
        color: 'info',
    },
}

const { data, status, refresh } = await useFetch('/api/admin/audit-log', {
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
    <UDashboardPanel id="audit-logs">
        <template #header>
            <UDashboardNavbar title="Audit Logs">
                <template #right>
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
            <UPageList class="gap-4">
                <UAlert
                    v-for="log in data.data"
                    :key="`log-${log.id}`"
                    :icon="auditLogAttributes[log.action].icon"
                    color="neutral"
                    variant="subtle"
                    :ui="{
                        wrapper: 'gap-2',
                    }"
                >
                    <template #title>
                        <div class="flex w-full items-center gap-2">
                            <span class="font-medium">
                                {{ auditLogAttributes[log.action].label }}
                            </span>

                            <NuxtLink
                                v-if="log.user"
                                :to="`/@${log.user.username}`"
                                class="ml-auto"
                            >
                                <UAvatar
                                    :src="log.user.image || undefined"
                                    :alt="log.user.name"
                                    icon="mingcute:user-3-fill"
                                    size="2xs"
                                />
                            </NuxtLink>
                            <NuxtTime
                                :datetime="log.createdAt"
                                relative
                                :locale
                                class="text-muted text-xs"
                            />
                        </div>
                    </template>

                    <template #description>
                        <div class="flex flex-col gap-3">
                            <p class="text-toned">{{ log.details }}</p>
                        </div>
                    </template>
                </UAlert>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
