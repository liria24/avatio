<template>
    <UPage :ui="{ center: 'flex flex-col gap-12' }" class="mt-6">
        <template #left>
            <UPageAside :ui="{ container: 'flex flex-col gap-6' }" class="h-fit">
                <UNavigationMenu
                    :items="[
                        [
                            {
                                to: $localePath('/settings'),
                                label: $t('settings.title'),
                                icon: 'mingcute:settings-1-fill',
                            },
                        ],
                        [
                            {
                                to: $localePath('/settings/profile'),
                                label: $t('settings.profile.title'),
                                icon: 'mingcute:user-3-fill',
                            },
                            {
                                to: $localePath('/settings/shops'),
                                label: $t('settings.shop.title'),
                                icon: 'mingcute:shop-fill',
                            },
                            {
                                to: $localePath('/settings/account'),
                                label: $t('settings.account.title'),
                                icon: 'mingcute:safe-lock-fill',
                            },
                            {
                                to: $localePath('/settings/notifications'),
                                label: '通知',
                                icon: 'mingcute:notification-fill',
                            },
                        ],
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
            </UPageAside>
        </template>

        <slot />
    </UPage>
</template>
