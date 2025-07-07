<script lang="ts" setup>
import type { Notification } from '#imports'

const props = defineProps<{ data: Notification }>()

const notificationsStore = useNotificationsStore()

const visible = ref(true)

const onRead = async (id: string) => {
    visible.value = false

    try {
        await $fetch('/api/notifications/read', {
            method: 'POST',
            body: { id },
        })
        notificationsStore.fetch()
    } catch (error) {
        console.error('Error marking notification as read:', error)
    }
}
</script>

<template>
    <div
        v-if="visible"
        class="ring-accented flex items-center gap-3 rounded-lg p-1.5 ring-1"
    >
        <NuxtLink
            v-if="props.data.actionUrl && !props.data.actionLabel"
            :to="$localePath(props.data.actionUrl)"
            class="grow pl-2"
        >
            <p
                class="text-toned text-xs wrap-anywhere break-keep"
                v-html="useLineBreak(props.data.title)"
            />
        </NuxtLink>
        <p
            v-else
            class="text-toned grow pl-2 text-xs wrap-anywhere break-keep"
            v-html="useLineBreak(props.data.title)"
        />

        <UButton
            v-if="props.data.actionUrl && props.data.actionLabel"
            :to="$localePath(props.data.actionUrl)"
            :label="props.data.actionLabel"
            icon="lucide:arrow-right"
            variant="outline"
            size="xs"
            @click="onRead(props.data.id)"
        />

        <UButton
            icon="lucide:x"
            variant="ghost"
            size="sm"
            class="place-self-end"
            @click="onRead(props.data.id)"
        />
    </div>
</template>
