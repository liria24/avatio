<template>
    <PopoverNotifications v-slot="{ unread }">
        <UTooltip text="通知" :delay-duration="50">
            <UChip :show="!!unread" color="neutral" inset>
                <UButton aria-label="通知" icon="mingcute:notification-fill" variant="ghost" />
            </UChip>
        </UTooltip>
    </PopoverNotifications>
</template>
