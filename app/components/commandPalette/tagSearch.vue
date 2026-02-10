<script setup lang="ts">
const emit = defineEmits<{
    select: [id: string]
}>()

const open = defineModel<boolean>({
    default: false,
})

const searchTerm = ref('')
const { t } = useI18n()

const { data: tags, status } = useSetupTags()

const existingTagsGroup = computed(() => ({
    id: 'existing-tags',
    label: t('commandPalette.tagSearch.existingTags'),
    items:
        tags.value?.map((tag, index) => ({
            id: `existing-${index}`,
            label: tag.tag,
            onSelect: () => {
                emit('select', tag.tag)
                open.value = false
                searchTerm.value = ''
            },
        })) ?? [],
}))

const newTagGroup = computed(() => ({
    id: 'new-tag',
    label: t('commandPalette.tagSearch.addNew'),
    items: [
        {
            id: 'new-tag-item',
            label: searchTerm.value,
            onSelect: () => {
                emit('select', searchTerm.value)
                open.value = false
                searchTerm.value = ''
            },
        },
    ],
}))

const groups = computed(() => {
    const hasSearchTerm = searchTerm.value.trim().length > 0
    const hasExistingTags = existingTagsGroup.value.items.length > 0

    if (hasSearchTerm) {
        const result = []

        result.push(newTagGroup.value)

        if (hasExistingTags) result.push(existingTagsGroup.value)

        return result
    }

    return hasExistingTags ? [existingTagsGroup.value] : []
})
</script>

<template>
    <UCommandPalette
        v-model:open="open"
        v-model:search-term="searchTerm"
        virtualize
        :loading="status === 'pending'"
        :placeholder="$t('commandPalette.tagSearch.placeholder')"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    />
</template>
