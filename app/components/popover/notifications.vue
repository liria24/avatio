<script setup lang="ts">
const open = ref(false)

const { all, status } = useNotifications()
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
        <slot />

        <template #content>
            <div class="flex w-full max-w-md flex-col gap-4 p-4 sm:w-sm md:w-md">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-lg leading-none font-bold text-nowrap">
                        {{ $t('notifications.title') }}
                    </span>
                </div>

                <USeparator />

                <Icon
                    v-if="status === 'pending'"
                    name="svg-spinners:ring-resize"
                    size="24"
                    class="text-muted m-8 self-center"
                />

                <p v-else-if="!all.length" class="text-muted my-8 self-center text-sm">
                    {{ $t('notifications.empty') }}
                </p>

                <div v-else class="flex flex-col gap-2">
                    <LazyUserNotification
                        v-for="notification in all"
                        :key="notification.id"
                        :notification
                    />
                </div>
            </div>
        </template>
    </UPopover>
</template>
