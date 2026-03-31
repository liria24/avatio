<script lang="ts" setup>
definePageMeta({
    middleware: 'authed',
})

const { t } = useI18n()
const permission = usePermission('notifications')
const { data: userSettings } = await useUserSettings()
const { update: updateUserSettings } = useUserSettingsUpdate()

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" title="通知">
        <div class="flex w-full flex-col gap-6">
            <section id="notif-destination" class="flex flex-col gap-4">
                <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">通知先</h3>

                <UCard :ui="{ body: 'flex flex-col gap-4' }">
                    <USwitch
                        label="サイト内"
                        description="アカウントの通知ボックスに通知を送信します。"
                        color="neutral"
                        :default-value="userSettings?.notifSiteEnabled"
                        @update:modelValue="
                            (value) => updateUserSettings({ notifSiteEnabled: value })
                        "
                    />
                    <USwitch
                        label="プッシュ通知"
                        description="ブラウザ標準のプッシュ通知を送信します。通知を受け取るにはブラウザの設定で権限を許可する必要があります。"
                        color="neutral"
                        :default-value="userSettings?.notifPushEnabled"
                        @update:modelValue="
                            (value) => updateUserSettings({ notifPushEnabled: value })
                        "
                    />
                    <USwitch
                        label="Webhook"
                        description="指定したURLに対してPOSTリクエストで通知を送信します。"
                        color="neutral"
                        disabled
                    />
                </UCard>
            </section>

            <section id="notif-destination" class="flex flex-col gap-4">
                <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                    通知の種類
                </h3>

                <UCard :ui="{ body: 'flex flex-col gap-4 @container' }">
                    <div class="ml-[50cqw] grid grid-cols-2 gap-2">
                        <span
                            class="text-muted text-center text-xs leading-none font-semibold text-nowrap"
                        >
                            サイト内
                        </span>
                        <span
                            class="text-muted text-center text-xs leading-none font-semibold text-nowrap"
                        >
                            プッシュ通知
                        </span>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">フォローされたとき</span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifSiteFollowed"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifSiteFollowed: value })
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifPushFollowed"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifPushFollowed: value })
                                "
                                class="mx-auto"
                            />
                        </div>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">
                            フォロー中のユーザーが投稿したとき
                        </span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifSiteFolloweePost"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifSiteFolloweePost: value })
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifPushFolloweePost"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifPushFolloweePost: value })
                                "
                                class="mx-auto"
                            />
                        </div>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">共同作者に自分が追加されたとき</span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifSiteCoauthorAdded"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifSiteCoauthorAdded: value })
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :default-value="userSettings?.notifPushCoauthorAdded"
                                @update:modelValue="
                                    (value) => updateUserSettings({ notifPushCoauthorAdded: value })
                                "
                                class="mx-auto"
                            />
                        </div>
                    </div>
                </UCard>
            </section>
        </div>
    </NuxtLayout>
</template>
