<script lang="ts" setup>
definePageMeta({
    middleware: 'authed',
})

const { t } = useI18n()
const { data: userSettings } = await useUserSettings()
const { update: updateUserSettings } = useUserSettingsUpdate()

type NotificationSettingKey = keyof Pick<
    UserSettings,
    | 'notifSiteEnabled'
    | 'notifSiteFollowed'
    | 'notifSiteFolloweePost'
    | 'notifSiteCoauthorAdded'
    | 'notifPushFollowed'
    | 'notifPushFolloweePost'
    | 'notifPushCoauthorAdded'
>

const notificationSettingKeys: NotificationSettingKey[] = [
    'notifSiteEnabled',
    'notifSiteFollowed',
    'notifSiteFolloweePost',
    'notifSiteCoauthorAdded',
    'notifPushFollowed',
    'notifPushFolloweePost',
    'notifPushCoauthorAdded',
]
const settingsState = reactive({ ...userSettingsDefaults, ...userSettings.value })
const pendingSettings = reactive(
    Object.fromEntries(notificationSettingKeys.map((key) => [key, false])) as Record<
        NotificationSettingKey,
        boolean
    >,
)

watch(
    userSettings,
    (value) => {
        if (value) Object.assign(settingsState, value)
    },
    { immediate: true },
)

const updateNotificationSetting = async (key: NotificationSettingKey, value: boolean) => {
    const previousValue = settingsState[key]
    settingsState[key] = value
    pendingSettings[key] = true

    try {
        await updateUserSettings({ [key]: value })
    } catch (error) {
        settingsState[key] = previousValue
        throw error
    } finally {
        pendingSettings[key] = false
    }
}

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.notifications.title')">
        <div class="flex w-full flex-col gap-6">
            <section id="notif-destination" class="flex flex-col gap-4">
                <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                    {{ $t('settings.notifications.destination.title') }}
                </h3>

                <UCard :ui="{ body: 'flex flex-col gap-4' }">
                    <USwitch
                        :label="$t('settings.notifications.destination.site')"
                        :description="$t('settings.notifications.destination.siteDescription')"
                        color="neutral"
                        :model-value="settingsState.notifSiteEnabled"
                        :loading="pendingSettings.notifSiteEnabled"
                        @update:model-value="
                            (value) => updateNotificationSetting('notifSiteEnabled', value)
                        "
                    />
                    <USwitch
                        :label="$t('settings.notifications.destination.push')"
                        :description="$t('settings.notifications.destination.pushDescription')"
                        color="neutral"
                        disabled
                    />
                    <USwitch
                        :label="$t('settings.notifications.destination.webhook')"
                        :description="$t('settings.notifications.destination.webhookDescription')"
                        color="neutral"
                        disabled
                    />
                </UCard>
            </section>

            <section id="notif-destination" class="flex flex-col gap-4">
                <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                    {{ $t('settings.notifications.types.title') }}
                </h3>

                <UCard :ui="{ body: 'flex flex-col gap-4 @container' }">
                    <div class="ml-[50cqw] grid grid-cols-2 gap-2">
                        <span
                            class="text-muted text-center text-xs leading-none font-semibold text-nowrap"
                        >
                            {{ $t('settings.notifications.destination.site') }}
                        </span>
                        <span
                            class="text-muted text-center text-xs leading-none font-semibold text-nowrap"
                        >
                            {{ $t('settings.notifications.destination.push') }}
                        </span>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">
                            {{ $t('settings.notifications.types.followed') }}
                        </span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifSiteFollowed"
                                :loading="pendingSettings.notifSiteFollowed"
                                @update:model-value="
                                    (value) => updateNotificationSetting('notifSiteFollowed', value)
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifPushFollowed"
                                :loading="pendingSettings.notifPushFollowed"
                                @update:model-value="
                                    (value) => updateNotificationSetting('notifPushFollowed', value)
                                "
                                class="mx-auto"
                            />
                        </div>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">
                            {{ $t('settings.notifications.types.followeePost') }}
                        </span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifSiteFolloweePost"
                                :loading="pendingSettings.notifSiteFolloweePost"
                                @update:model-value="
                                    (value) =>
                                        updateNotificationSetting('notifSiteFolloweePost', value)
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifPushFolloweePost"
                                :loading="pendingSettings.notifPushFolloweePost"
                                @update:model-value="
                                    (value) =>
                                        updateNotificationSetting('notifPushFolloweePost', value)
                                "
                                class="mx-auto"
                            />
                        </div>
                    </div>

                    <div class="grid w-full grid-cols-2 gap-2">
                        <span class="text-sm font-medium">
                            {{ $t('settings.notifications.types.coauthorAdded') }}
                        </span>

                        <div class="grid grid-cols-2 gap-2">
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifSiteCoauthorAdded"
                                :loading="pendingSettings.notifSiteCoauthorAdded"
                                @update:model-value="
                                    (value) =>
                                        updateNotificationSetting('notifSiteCoauthorAdded', value)
                                "
                                class="mx-auto"
                            />
                            <USwitch
                                color="neutral"
                                :model-value="settingsState.notifPushCoauthorAdded"
                                :loading="pendingSettings.notifPushCoauthorAdded"
                                @update:model-value="
                                    (value) =>
                                        updateNotificationSetting('notifPushCoauthorAdded', value)
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
