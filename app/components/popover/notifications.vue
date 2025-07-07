<script setup lang="ts">
const notificationsStore = useNotificationsStore()

const localePath = useLocalePath()

const open = ref(false)
const viewingReadNotifications = ref(false)

const notifications = computed(() =>
    notificationsStore.notifications.filter((notification) => {
        if (viewingReadNotifications.value) return !!notification.readAt
        return !notification.readAt
    })
)

const onRead = async (event: Event, id: string) => {
    event.stopPropagation()
    await $fetch('/api/notifications/read', {
        method: 'POST',
        body: { id },
    })
    notificationsStore.fetch()
}

const onUnread = async (event: Event, id: string) => {
    event.stopPropagation()
    await $fetch('/api/notifications/unread', {
        method: 'POST',
        body: { id },
    })
    notificationsStore.fetch()
}

const onClick = (event: Event, id: string, actionUrl: string | null) => {
    onRead(event, id)
    open.value = false
    if (actionUrl) navigateTo(localePath(actionUrl))
}

watch(open, (isOpen) => {
    if (!isOpen && viewingReadNotifications.value) {
        viewingReadNotifications.value = false
        notificationsStore.fetch()
    }
})
</script>

<template>
    <UPopover
        v-model:open="open"
        :content="{
            align: 'end',
            side: 'bottom',
        }"
        modal
    >
        <slot :unread="notificationsStore?.unread || 0" />

        <template #content>
            <div class="flex w-md max-w-md flex-col gap-4 p-4">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-lg leading-none font-bold text-nowrap">
                        通知
                    </span>

                    <UButton
                        label="既読の通知"
                        variant="soft"
                        size="sm"
                        :active="viewingReadNotifications"
                        active-variant="subtle"
                        class="rounded-full"
                        @click="
                            viewingReadNotifications = !viewingReadNotifications
                        "
                    />
                </div>

                <USeparator />

                <Icon
                    v-if="notificationsStore.fetching"
                    name="svg-spinners:ring-resize"
                    size="24"
                    class="text-muted m-8 self-center"
                />

                <p
                    v-else-if="!notifications.length"
                    class="text-muted my-8 self-center text-sm"
                >
                    新しい通知はありません
                </p>

                <div v-else class="flex flex-col gap-2">
                    <UButton
                        v-for="notification in notifications"
                        :key="notification.id"
                        variant="ghost"
                        class="flex flex-col items-start gap-2 rounded-lg p-2"
                        @click="
                            onClick(
                                $event,
                                notification.id,
                                notification.actionUrl
                            )
                        "
                    >
                        <div class="flex w-full items-start gap-2">
                            <p
                                :data-unread="!notification.readAt"
                                class="text-muted data-[unread=true]:text-toned grow px-1 text-left text-sm wrap-anywhere break-keep"
                                v-html="useLineBreak(notification.title)"
                            />
                            <NuxtTime
                                :datetime="notification.createdAt"
                                relative
                                class="text-muted p-1 text-xs leading-none text-nowrap"
                            />
                        </div>
                        <div
                            class="flex w-full items-center justify-end-safe gap-2 empty:hidden"
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
                                @click="
                                    onClick(
                                        $event,
                                        notification.id,
                                        notification.actionUrl
                                    )
                                "
                            />

                            <UTooltip
                                v-if="!notification.readAt"
                                text="既読にする"
                                :delay-duration="100"
                            >
                                <UButton
                                    icon="lucide:mail-open"
                                    variant="ghost"
                                    size="xs"
                                    class="self-end"
                                    @click="onRead($event, notification.id)"
                                />
                            </UTooltip>

                            <UTooltip
                                v-else
                                text="未読にする"
                                :delay-duration="100"
                            >
                                <UButton
                                    icon="lucide:mail"
                                    variant="ghost"
                                    size="xs"
                                    class="self-end"
                                    @click="onUnread($event, notification.id)"
                                />
                            </UTooltip>
                        </div>
                    </UButton>
                </div>
            </div>
        </template>
    </UPopover>
</template>
