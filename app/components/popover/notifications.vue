<script setup lang="ts">
const { data: notifications, status, refresh } = useNotifications()
const newNotifications = computed(
    () => notifications.value?.data.filter((n) => !n.readAt) || []
)

const localePath = useLocalePath()

const open = ref(false)

const onClick = (id: string, actionUrl: string | null) => {
    $fetch('/api/notifications/read', {
        method: 'POST',
        body: { id },
    })

    open.value = false
    refresh()

    if (actionUrl) navigateTo(localePath(actionUrl))
}
</script>

<template>
    <UPopover v-model:open="open">
        <slot :unread="!!newNotifications.length" />

        <template #content>
            <div class="flex w-md max-w-md flex-col gap-4 p-4">
                <span class="text-lg leading-none font-bold text-nowrap">
                    通知
                </span>

                <USeparator />

                <Icon
                    v-if="status !== 'success'"
                    name="svg-spinners:ring-resize"
                    size="24"
                    class="text-muted m-8 self-center"
                />

                <p
                    v-else-if="!notifications?.data.length"
                    class="text-muted my-8 self-center text-sm"
                >
                    新しい通知はありません
                </p>

                <div v-else class="flex flex-col gap-2">
                    <UButton
                        v-for="notification in notifications.data"
                        :key="notification.id"
                        variant="ghost"
                        class="flex flex-col items-start gap-2 rounded-lg p-2"
                        @click="
                            onClick(notification.id, notification.actionUrl)
                        "
                    >
                        <div class="flex w-full items-start gap-2">
                            <p class="text-toned grow px-1 text-left text-sm">
                                {{ notification.title }}
                            </p>
                            <NuxtTime
                                :datetime="notification.createdAt"
                                relative
                                class="text-muted p-1 text-xs leading-none text-nowrap"
                            />
                        </div>
                        <div
                            class="flex w-full items-center justify-end-safe gap-2"
                        >
                            <UButton
                                v-if="
                                    notification.actionUrl &&
                                    notification.actionLabel
                                "
                                :to="$localePath(notification.actionUrl)"
                                :label="notification.actionLabel"
                                icon="lucide:arrow-right"
                                variant="outline"
                                size="xs"
                            />

                            <UButton
                                icon="lucide:mail-open"
                                variant="ghost"
                                size="xs"
                                class="self-end"
                            />
                        </div>
                    </UButton>
                </div>
            </div>
        </template>
    </UPopover>
</template>
