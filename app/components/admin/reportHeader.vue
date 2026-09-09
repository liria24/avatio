<script setup lang="ts">
interface Props {
    id: number
    isResolved: boolean
    createdAt: string | Date
    reporter: Pick<User, 'name' | 'image'>
}

defineProps<Props>()
const emit = defineEmits<{
    resolve: [id: number, isResolved: boolean]
}>()

const { locale } = useI18n()
</script>

<template>
    <div class="flex w-full items-center gap-2">
        <span class="text-muted text-lg leading-none font-light text-nowrap"> #{{ id }} </span>
        <UBadge
            :label="isResolved ? 'Closed' : 'Open'"
            :icon="isResolved ? 'lucide:circle-slash' : 'mingcute:three-quarters-circle-dash-fill'"
            :color="isResolved ? 'neutral' : 'success'"
            variant="outline"
            class="rounded-full py-1.5 pr-3 pl-2.5"
        />
        <NuxtTime :datetime="createdAt" relative :locale class="text-muted text-xs" />

        <div class="flex grow items-center justify-end gap-2">
            <UUser
                :avatar="{
                    src: reporter.image || undefined,
                    alt: reporter.name,
                    icon: 'mingcute:user-3-fill',
                }"
                :name="reporter.name"
                size="sm"
                class="mr-2"
            />

            <slot />

            <UButton
                loading-auto
                :icon="isResolved ? 'mingcute:close-line' : 'mingcute:check-line'"
                :label="isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'"
                color="neutral"
                :variant="isResolved ? 'subtle' : 'solid'"
                size="sm"
                @click="emit('resolve', id, !isResolved)"
            />
        </div>
    </div>
</template>
