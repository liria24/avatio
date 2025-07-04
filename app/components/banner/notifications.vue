<script lang="ts" setup>
const { data } = await useNotifications({ query: { read: false } })

const onClick = async () => {
    await $fetch('/api/notifications/read', {
        method: 'POST',
    })
}
</script>

<template>
    <div v-if="data?.data.length" class="flex flex-col gap-2">
        <div
            v-for="notification in data?.data"
            :key="notification.id"
            class="ring-accented flex items-center gap-3 rounded-lg p-1.5 ring-1"
        >
            <NuxtLink
                v-if="notification.actionUrl && !notification.actionLabel"
                :to="$localePath(notification.actionUrl)"
            >
                <p
                    class="text-toned grow pl-2 text-xs wrap-anywhere break-keep"
                    v-html="useLineBreak(notification.title)"
                />
            </NuxtLink>
            <p
                v-else
                class="text-toned grow pl-2 text-xs wrap-anywhere break-keep"
                v-html="useLineBreak(notification.title)"
            />

            <UButton
                v-if="notification.actionUrl && notification.actionLabel"
                :to="$localePath(notification.actionUrl)"
                :label="notification.actionLabel"
                icon="lucide:arrow-right"
                variant="outline"
                size="xs"
            />

            <UButton
                icon="lucide:x"
                variant="ghost"
                size="sm"
                class="place-self-end"
                @click="onClick"
            />
        </div>
    </div>
</template>
