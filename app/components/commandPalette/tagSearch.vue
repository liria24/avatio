<script setup lang="ts">
const emit = defineEmits<{
    select: [id: string]
}>()

const open = defineModel<boolean>({
    default: false,
})

const searchTerm = ref('')

const { data: tags, status } = useFetch('/api/setup/tag', {
    key: 'tag-search',
    default: () => [],
})

const existingTagsGroup = computed(() => ({
    id: 'existing-tags',
    label: '既存タグ',
    items: tags.value.map((tag, index) => ({
        id: `existing-${index}`,
        label: tag.tag,
        onSelect: () => {
            open.value = false
            emit('select', tag.tag)
        },
    })),
}))

const newTagGroup = computed(() => ({
    id: 'new-tag',
    label: '新しく追加',
    items: [
        {
            id: 'new-tag-item',
            label: searchTerm.value,
            onSelect: () => {
                open.value = false
                emit('select', searchTerm.value)
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
        :loading="status === 'pending'"
        placeholder="タグを検索 / 入力"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    />
</template>
