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
    <div v-if="visible" class="ring-accented flex items-center gap-3 rounded-lg p-2 ring-1">
        <div
            v-if="props.data.actionUrl && !props.data.actionLabel"
            class="flex grow flex-col gap-1 pl-2"
        >
            <NuxtLink :to="$localePath(props.data.actionUrl)">
                <p class="text-toned sentence text-xs">
                    {{ props.data.title }}
                </p>
            </NuxtLink>
            <p v-if="props.data.message?.length" class="text-muted sentence text-xs">
                {{ props.data.message }}
            </p>
        </div>
        <div v-else class="flex grow flex-col gap-1 pl-2">
            <p class="text-toned sentence text-xs">
                {{ props.data.title }}
            </p>
            <p v-if="props.data.message?.length" class="text-muted sentence text-xs">
                {{ props.data.message }}
            </p>
        </div>

        <UButton
            v-if="props.data.actionUrl && props.data.actionLabel"
            :to="$localePath(props.data.actionUrl)"
            :label="props.data.actionLabel"
            icon="lucide:arrow-right"
            variant="outline"
            size="xs"
            @click="onRead(props.data.id)"
        />

        <UButton icon="lucide:x" variant="ghost" size="sm" @click="onRead(props.data.id)" />
    </div>
</template>
