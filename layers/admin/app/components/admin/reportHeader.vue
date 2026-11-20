<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
interface Props {
    actions: DropdownMenuItem[][]
    id: number
    isResolved: boolean
    createdAt: string | Date
    reporter: Pick<User, 'name' | 'image' | 'username'>
}

defineProps<Props>()
const emit = defineEmits<{
    resolve: [id: number, isResolved: boolean]
}>()

const { locale } = useI18n()
</script>

<template>
    <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-muted text-lg leading-none font-light text-nowrap"> #{{ id }} </span>
            <UBadge
                :label="
                    isResolved ? $t('admin.reports.status.closed') : $t('admin.reports.status.open')
                "
                :icon="
                    isResolved ? 'lucide:circle-slash' : 'mingcute:three-quarters-circle-dash-fill'
                "
                :color="isResolved ? 'neutral' : 'success'"
                variant="outline"
                class="rounded-full py-1.5 pr-3 pl-2.5"
            />
            <NuxtTime :datetime="createdAt" relative :locale class="text-muted text-xs" />
        </div>

        <div class="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
            <ULink :to="`/@${reporter.username}`" class="mr-auto sm:mr-2">
                <UUser
                    :avatar="{
                        src: reporter.image || undefined,
                        alt: reporter.name,
                        icon: 'mingcute:user-3-fill',
                    }"
                    :name="reporter.name"
                    :description="`@${reporter.username}`"
                    size="sm"
                />
            </ULink>

            <UDropdownMenu :items="actions">
                <UButton
                    :aria-label="$t('admin.reports.actions.label')"
                    icon="mingcute:more-2-line"
                    color="neutral"
                    variant="outline"
                    size="sm"
                />
            </UDropdownMenu>

            <UButton
                loading-auto
                :icon="isResolved ? 'mingcute:close-line' : 'mingcute:check-line'"
                :label="
                    isResolved
                        ? $t('admin.reports.actions.reopen')
                        : $t('admin.reports.actions.resolve')
                "
                color="neutral"
                :variant="isResolved ? 'subtle' : 'solid'"
                size="sm"
                @click="emit('resolve', id, !isResolved)"
            />
        </div>
    </div>
</template>
