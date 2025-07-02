<script lang="ts" setup>
const nuxtApp = useNuxtApp()

const auditLogAttributes: Record<
    AuditActionType,
    {
        icon: string
        label: string
        color:
            | 'primary'
            | 'success'
            | 'error'
            | 'info'
            | 'secondary'
            | 'warning'
            | 'neutral'
    }
> = {
    user_ban: {
        icon: 'lucide:ban',
        label: 'ユーザーをBAN',
        color: 'error',
    },
    user_unban: {
        icon: 'lucide:undo-2',
        label: 'ユーザーのBAN解除',
        color: 'info',
    },
    user_delete: {
        icon: 'lucide:user-round-x',
        label: 'ユーザーを削除',
        color: 'error',
    },
    user_role_change: {
        icon: 'lucide:user-round-check',
        label: 'ユーザーロールの変更',
        color: 'info',
    },
    user_shop_verify: {
        icon: 'lucide:store',
        label: 'ユーザーのショップを承認',
        color: 'success',
    },
    user_shop_unverify: {
        icon: 'lucide:x-circle',
        label: 'ユーザーのショップを非承認',
        color: 'error',
    },
    user_badge_grant: {
        icon: 'lucide:award',
        label: 'ユーザーにバッジを付与',
        color: 'success',
    },
    user_badge_revoke: {
        icon: 'lucide:award',
        label: 'ユーザーのバッジを剥奪',
        color: 'error',
    },
    setup_hide: {
        icon: 'lucide:eye-off',
        label: 'セットアップを非表示',
        color: 'secondary',
    },
    setup_unhide: {
        icon: 'lucide:eye',
        label: 'セットアップを表示',
        color: 'secondary',
    },
    setup_delete: {
        icon: 'lucide:trash',
        label: 'セットアップを削除',
        color: 'error',
    },
    report_resolve: {
        icon: 'lucide:check-circle',
        label: '報告を解決',
        color: 'success',
    },
    feedback_close: {
        icon: 'lucide:check-circle',
        label: 'フィードバックをクローズ',
        color: 'success',
    },
    cleanup: {
        icon: 'lucide:trash',
        label: 'クリーンアップ',
        color: 'info',
    },
}

const { data } = useFetch<PaginationResponse<AuditLog[]>>(
    '/api/admin/audit-log',
    {
        dedupe: 'defer',
        getCachedData: (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
            return undefined
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
    }
)
</script>

<template>
    <div class="flex w-full flex-col gap-6">
        <h1 class="font-[Geist] text-3xl text-nowrap">Admin Console</h1>
        <div v-if="data" class="flex flex-col gap-4">
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
                            :to="`/@${log.user.id}`"
                            class="text-muted flex items-center gap-2"
                        >
                            <UAvatar
                                :src="log.user.image || undefined"
                                :alt="log.user.name"
                                size="2xs"
                            />
                            <span class="text-xs font-medium">
                                {{ log.user.name }}
                            </span>
                        </NuxtLink>
                    </div>
                </template>
            </UAlert>
        </div>
    </div>
</template>
