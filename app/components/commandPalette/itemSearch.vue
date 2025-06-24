<script setup lang="ts">
const emit = defineEmits<{
    (e: 'select', id: string): void
}>()

const open = defineModel<boolean>({
    default: false,
})

const searchTerm = ref('')

const categoryAttributes = itemCategoryAttributes()

const { data, status } = useFetch('/api/item', {
    query: {
        limit: 500,
    },
    key: 'item-search',
    transform: (data) => {
        return itemCategorySchema.options.map((category) => ({
            id: category,
            label: categoryAttributes[category].label,
            items: data.data
                .filter((item: Item) => item.category === category)
                .map((item: Item) => ({
                    id: item.id,
                    label: item.name,
                    shop: item.shop.name,
                    image: item.image,
                    slot: 'item' as const,
                    onSelect: () => {
                        open.value = false
                        emit('select', item.id)
                    },
                })),
        }))
    },
})

const groups = computed(() => {
    try {
        new URL(searchTerm.value)

        if (searchTerm.value.length) {
            return [
                {
                    id: 'search',
                    label: 'URLから追加',
                    items: [
                        {
                            id: 'url',
                            label: searchTerm.value,
                            slot: 'url',
                            onSelect: () => {
                                open.value = false
                            },
                        },
                    ],
                },
                // @ts-expect-error TypeScript doesn't recognize the type of `data.value`
                ...data.value,
            ]
        }
        return data.value
    } catch {
        return data.value
    }
})
</script>

<template>
    <UCommandPalette
        v-model:open="open"
        v-model:search-term="searchTerm"
        :loading="status === 'pending'"
        placeholder="アイテムを検索 / URLを入力"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    >
        <template #item="{ item }">
            <NuxtImg :src="item.image" class="size-6 rounded-md object-cover" />
            <div class="flex cursor-pointer items-center gap-2">
                <span class="text-toned text-xs">
                    {{ item.label }}
                </span>
                <span class="text-muted text-xs">
                    {{ item.shop }}
                </span>
            </div>
        </template>
    </UCommandPalette>
</template>
