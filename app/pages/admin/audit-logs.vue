<script lang="ts" setup>
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

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
        label: 'ユーザーをBAN',
        color: 'error',
    },
    user_unban: {
        icon: 'mingcute:back-fill',
        label: 'ユーザーのBAN解除',
        color: 'info',
    },
    user_delete: {
        icon: 'mingcute:user-x-fill',
        label: 'ユーザーを削除',
        color: 'error',
    },
    user_role_change: {
        icon: 'mingcute:user-security-fill',
        label: 'ユーザーロールの変更',
        color: 'info',
    },
    user_shop_verify: {
        icon: 'mingcute:store-fill',
        label: 'ユーザーのショップを承認',
        color: 'success',
    },
    user_shop_unverify: {
        icon: 'mingcute:close-circle-fill',
        label: 'ユーザーのショップを非承認',
        color: 'error',
    },
    user_badge_grant: {
        icon: 'mingcute:award-fill',
        label: 'ユーザーにバッジを付与',
        color: 'success',
    },
    user_badge_revoke: {
        icon: 'mingcute:award-fill',
        label: 'ユーザーのバッジを剥奪',
        color: 'error',
    },
    setup_hide: {
        icon: 'mingcute:eye-close-fill',
        label: 'セットアップを非表示',
        color: 'secondary',
    },
    setup_unhide: {
        icon: 'mingcute:eye-2-fill',
        label: 'セットアップを表示',
        color: 'secondary',
    },
    setup_delete: {
        icon: 'mingcute:delete-2-fill',
        label: 'セットアップを削除',
        color: 'error',
    },
    report_resolve: {
        icon: 'mingcute:check-circle-fill',
        label: '報告を解決',
        color: 'success',
    },
    feedback_close: {
        icon: 'mingcute:forbid-circle-fill',
        label: 'フィードバックをクローズ',
        color: 'success',
    },
    cleanup: {
        icon: 'mingcute:delete-2-fill',
        label: 'クリーンアップ',
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
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause !== 'initial' ? undefined : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
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
                    :color="auditLogAttributes[log.action].color"
                    variant="subtle"
                    :ui="{
                        wrapper: 'gap-2',
                    }"
                >
                    <template #title>
                        <div class="flex w-full items-center justify-between gap-2">
                            <span class="font-medium">
                                {{ auditLogAttributes[log.action].label }}
                            </span>

                            <NuxtTime
                                :datetime="log.createdAt"
                                relative
                                class="text-muted text-xs"
                            />
                        </div>
                    </template>

                    <template #description>
                        <div class="flex flex-col gap-3">
                            <p class="text-toned">{{ log.details }}</p>

                            <NuxtLink
                                v-if="log.user"
                                :to="`/@${log.user.username}`"
                                class="text-muted flex items-center gap-2"
                            >
                                <UAvatar
                                    :src="log.user.image || undefined"
                                    :alt="log.user.name"
                                    icon="mingcute:user-3-fill"
                                    size="2xs"
                                />
                                <span class="text-xs font-medium">
                                    {{ log.user.name }}
                                </span>
                            </NuxtLink>
                        </div>
                    </template>
                </UAlert>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
