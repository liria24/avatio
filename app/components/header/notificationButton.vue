<template>
    <PopoverNotifications v-slot="{ unread }">
        <UTooltip :text="$t('header.notifications')" :delay-duration="50">
            <UChip :show="!!unread" color="neutral" inset>
                <UButton
                    :aria-label="$t('header.notifications')"
                    icon="mingcute:notification-fill"
                    variant="ghost"
                />
            </UChip>
        </UTooltip>
    </PopoverNotifications>
</template>
