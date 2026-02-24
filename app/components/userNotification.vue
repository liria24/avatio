<script setup lang="ts">
import type { Notification } from '#imports'

interface Props {
    notification: Serialized<Notification>
}
const { notification } = defineProps<Props>()

const emit = defineEmits(['click', 'read', 'unread'])

const { locale } = useI18n()
const { markAsRead, markAsUnread, open: openNotification } = useNotifications()
const { labels, href } = useNotificationAttributes(notification.type, notification.payload)
const to = computed(() => href || notification.actionUrl)
</script>

<template>
    <div class="hover:bg-muted flex flex-col items-start gap-2 rounded-lg p-2">
        <div class="flex w-full items-start gap-2">
            <NuxtLink
                :to="to || undefined"
                :data-unread="!notification.readAt"
                tabindex="0"
                class="text-muted data-[unread=true]:text-toned sentence grow px-1 text-left text-sm"
                @click="markAsRead(notification.id)"
            >
                {{ labels.title }}
            </NuxtLink>

            <div class="flex items-center gap-1">
                <NuxtTime
                    :datetime="notification.createdAt"
                    relative
                    :locale
                    class="text-muted p-1 text-xs leading-none text-nowrap"
                />

                <UTooltip
                    :text="
                        !notification.readAt
                            ? $t('notifications.markAsRead')
                            : $t('notifications.markAsUnread')
                    "
                    :delay-duration="100"
                >
                    <UButton
                        :aria-label="
                            !notification.readAt
                                ? $t('notifications.markAsRead')
                                : $t('notifications.markAsUnread')
                        "
                        :icon="
                            !notification.readAt ? 'mingcute:mail-open-fill' : 'mingcute:mail-fill'
                        "
                        variant="ghost"
                        size="xs"
                        @click="
                            !notification.readAt
                                ? markAsRead(notification.id)
                                : markAsUnread(notification.id)
                        "
                    />
                </UTooltip>
            </div>
        </div>

        <div class="flex w-full items-center justify-end-safe gap-2 empty:hidden">
            <p
                v-if="labels.message"
                :data-unread="!notification.readAt"
                class="text-dimmed data-[unread=true]:text-muted sentence grow px-1 text-left text-xs"
            >
                {{ labels.message }}
            </p>

            <UButton
                v-if="to && labels.actionLabel"
                :to="$localePath(to)"
                :label="labels.actionLabel"
                icon="mingcute:arrow-right-line"
                variant="outline"
                size="xs"
                @click="openNotification(notification.id, to)"
            />
        </div>
    </div>
</template>
