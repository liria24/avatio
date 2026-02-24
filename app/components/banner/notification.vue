<script lang="ts" setup>
import type { Notification } from '#imports'

interface Props {
    notification: Serialized<Notification>
}
const { notification } = defineProps<Props>()

const { markAsRead } = useNotifications()

const visible = ref(true)

const onRead = async (id: string) => {
    visible.value = false
    await markAsRead(id)
}

const { labels, href } = useNotificationAttributes(notification.type, notification.payload)
const to = computed(() => href || notification.actionUrl)
</script>

<template>
    <div v-if="visible" class="ring-accented flex items-center gap-3 rounded-lg p-2 ring-1">
        <div v-if="to && !labels.actionLabel" class="flex grow flex-col gap-1 pl-2">
            <NuxtLink :to="$localePath(to)">
                <p class="text-toned sentence text-xs">
                    {{ labels.title }}
                </p>
            </NuxtLink>
            <p v-if="labels.message?.length" class="text-muted sentence text-xs">
                {{ labels.message }}
            </p>
        </div>
        <div v-else class="flex grow flex-col gap-1 pl-2">
            <p class="text-toned sentence text-xs">
                {{ labels.title }}
            </p>
            <p v-if="labels.message?.length" class="text-muted sentence text-xs">
                {{ labels.message }}
            </p>
        </div>

        <UButton
            v-if="to && labels.actionLabel"
            :to="$localePath(to)"
            :label="labels.actionLabel"
            icon="mingcute:arrow-right-line"
            variant="outline"
            size="xs"
            @click="onRead(notification.id)"
        />

        <UButton
            icon="mingcute:close-line"
            variant="ghost"
            size="sm"
            @click="onRead(notification.id)"
        />
    </div>
</template>
