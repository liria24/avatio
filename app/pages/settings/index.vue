<script lang="ts" setup>
definePageMeta({
    auth: 'user',
})

const { t } = useI18n()
const { data: userSettings } = await useUserSettings()
const { update: updateUserSettings } = useUserSettingsUpdate()

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.general.title')">
        <SettingsProfileSection />

        <section id="display" class="flex flex-col gap-4">
            <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.general.display.title') }}
            </h3>

            <UCard :ui="{ body: 'flex flex-col gap-4' }">
                <USwitch
                    :label="$t('settings.general.display.showNSFW')"
                    color="neutral"
                    :default-value="userSettings?.showNSFW"
                    @update:modelValue="(value) => updateUserSettings({ showNSFW: value })"
                />
            </UCard>
        </section>

        <SettingsSiteSection />
    </NuxtLayout>
</template>
