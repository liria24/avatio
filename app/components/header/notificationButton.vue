<template>
    <PopoverNotifications v-slot="{ unread }">
        <UTooltip text="通知" :delay-duration="50">
            <UChip :show="!!unread" color="neutral" inset>
                <UButton icon="lucide:bell" variant="ghost" />
            </UChip>
        </UTooltip>
    </PopoverNotifications>
</template>
