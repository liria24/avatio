<script setup lang="ts">
const props = defineProps<{ name: string; index: number; count: number }>()
const emit = defineEmits<{ move: [direction: -1 | 1] }>()
const { t } = useI18n()
const trigger = useTemplateRef<{ $el: HTMLButtonElement }>('trigger')
const move = async (direction: -1 | 1) => {
    emit('move', direction)
    await nextTick()
    trigger.value?.$el.focus()
}
const actions = computed(() => [
    {
        label: t('reorder.up'),
        icon: 'mingcute:arrow-up-line',
        disabled: props.index === 0,
        onSelect: () => move(-1),
    },
    {
        label: t('reorder.down'),
        icon: 'mingcute:arrow-down-line',
        disabled: props.index === props.count - 1,
        onSelect: () => move(1),
    },
])
</script>

<template>
    <UDropdownMenu :items="actions">
        <UButton
            ref="trigger"
            type="button"
            icon="mingcute:sort-ascending-line"
            :aria-label="$t('reorder.label', { name })"
            variant="ghost"
            size="xs"
            data-reorder
        />
    </UDropdownMenu>
</template>
