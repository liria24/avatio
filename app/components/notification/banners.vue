<script lang="ts" setup>
const { unread } = useNotifications()
const filteredNotifications = computed(() => unread.value.filter((n) => n.banner))
</script>

<template>
    <div v-if="filteredNotifications.length" class="flex w-full flex-col gap-2">
        <LazyNotificationBanner
            v-for="notification in filteredNotifications"
            :key="notification.id"
            :notification
            class="w-full"
        />
    </div>
</template>
