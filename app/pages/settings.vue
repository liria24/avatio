<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
})

const { t } = useI18n()

defineSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <UPage :ui="{ center: 'flex flex-col gap-12' }" class="mt-6">
        <template #right>
            <UPageAside :ui="{ container: 'flex flex-col gap-6' }" class="h-fit">
                <UPageLinks
                    :links="[
                        {
                            to: '#site',
                            label: $t('settings.site.title'),
                        },
                        {
                            to: '#profile',
                            label: $t('settings.profile.title'),
                        },
                        {
                            to: '#shop',
                            label: $t('settings.shop.title'),
                        },
                        {
                            to: '#account',
                            label: $t('settings.account.title'),
                        },
                    ]"
                />
            </UPageAside>
        </template>

        <SettingSite section-id="site" />

        <USeparator />

        <SettingProfile section-id="profile" />

        <SettingShop section-id="shop" />

        <SettingAccount section-id="account" />
    </UPage>
</template>
