<script setup lang="ts">
const { unreadCount } = useNotifications()
</script>

<template>
    <PopoverNotifications>
        <UTooltip :text="$t('header.notifications')" :delay-duration="50">
            <UChip :show="!!unreadCount" color="neutral" inset>
                <UButton
                    :aria-label="$t('header.notifications')"
                    icon="mingcute:notification-fill"
                    variant="ghost"
                />
            </UChip>
        </UTooltip>
    </PopoverNotifications>
</template>
