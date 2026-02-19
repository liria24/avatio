<script lang="ts" setup>
definePageMeta({
    middleware: 'authed',
})

const { t } = useI18n()
const permission = usePermission('notifications')

defineSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings">
        <div class="flex w-full flex-col gap-6">
            <UPageCard
                title="サイト内通知"
                description="アカウントの通知ボックスに通知を送信します。"
                orientation="horizontal"
                variant="naked"
                :ui="{ container: 'lg:items-start', description: 'sentence' }"
            >
                <div class="ml-auto flex w-fit min-w-64 flex-col gap-3">
                    <USwitch label="サイト内通知を有効化" color="neutral" />

                    <USeparator />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        ユーザー
                    </span>
                    <USwitch label="フォローされたとき" color="neutral" />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        セットアップ
                    </span>
                    <USwitch label="フォロー中のユーザーの投稿" color="neutral" />
                    <USwitch label="共同作者に自分が追加された投稿" color="neutral" />
                </div>
            </UPageCard>

            <USeparator />

            <UPageCard
                title="プッシュ通知"
                description="ブラウザ標準のプッシュ通知を送信します。通知を受け取るにはブラウザの設定で権限を許可する必要があります。"
                orientation="horizontal"
                variant="naked"
                :ui="{ container: 'lg:items-start', description: 'sentence' }"
            >
                <div class="ml-auto flex w-fit min-w-64 flex-col gap-3">
                    <UBadge
                        v-if="permission === 'denied'"
                        icon="mingcute:close-line"
                        label="通知が許可されていません"
                        variant="soft"
                        color="error"
                        size="lg"
                    />

                    <USwitch label="プッシュ通知を有効化" color="neutral" />

                    <USeparator />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        ユーザー
                    </span>
                    <USwitch label="フォローされたとき" color="neutral" />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        セットアップ
                    </span>
                    <USwitch label="フォロー中のユーザーの投稿" color="neutral" />
                    <USwitch label="共同作者に自分が追加された投稿" color="neutral" />
                </div>
            </UPageCard>

            <USeparator />

            <UPageCard
                title="Webhook"
                description="指定したURLに対してPOSTリクエストで通知を送信します。"
                orientation="horizontal"
                variant="naked"
                :ui="{ container: 'lg:items-start', description: 'sentence' }"
            >
                <div class="ml-auto flex w-fit min-w-64 flex-col gap-3">
                    <UFormField label="Webhook URL">
                        <UInput placeholder="https://example.com/webhook" class="w-full" />

                        <template #help>
                            <UButton
                                label="テスト通知を送信"
                                variant="link"
                                size="sm"
                                class="p-0"
                            />
                        </template>
                    </UFormField>

                    <USeparator />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        ユーザー
                    </span>
                    <USwitch label="フォローされたとき" color="neutral" />

                    <span class="text-muted text-xs leading-none font-semibold text-nowrap">
                        セットアップ
                    </span>
                    <USwitch label="フォロー中のユーザーの投稿" color="neutral" />
                    <USwitch label="共同作者に自分が追加された投稿" color="neutral" />
                </div>
            </UPageCard>
        </div>
    </NuxtLayout>
</template>
