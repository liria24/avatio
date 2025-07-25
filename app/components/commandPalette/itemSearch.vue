<script setup lang="ts">
const emit = defineEmits<{
    select: [item: Item]
}>()

const open = defineModel<boolean>({
    default: false,
})
const props = defineProps<{
    loading?: boolean
}>()

const searchTerm = ref('')
const loadingRef = ref(false)

const toast = useToast()
const categoryAttributes = itemCategoryAttributes()

const { data, status } = useFetch('/api/items', {
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
                    onSelect: () => onSelect(item.id),
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
                                const result = extractItemId(searchTerm.value)
                                if (result) onSelect(result.id, result.platform)
                                else
                                    toast.add({
                                        title: '無効なURL',
                                        description:
                                            '正しいアイテムのURLを入力してください。',
                                        color: 'error',
                                    })
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

const loadingComputed = computed(
    () => props.loading || loadingRef.value || status.value === 'pending'
)

const onSelect = async (id: string, platform?: Platform) => {
    loadingRef.value = true

    try {
        const response = await $fetch<Item>(`/api/items/${id}`, {
            query: { platform },
        })
        emit('select', response)
        open.value = false
        searchTerm.value = ''
    } catch (error) {
        console.error('Failed to fetch item:', error)
        toast.add({
            title: 'アイテムの取得に失敗しました',
            description:
                'アイテムが存在しないか、非公開になっている可能性があります。',
            color: 'error',
        })
        return
    } finally {
        loadingRef.value = false
    }
}
</script>

<template>
    <UCommandPalette
        v-model:open="open"
        v-model:search-term="searchTerm"
        :loading="loadingComputed"
        placeholder="アイテムを検索 / URLを入力"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    >
        <template #item="{ item }">
            <NuxtImg
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="item.image"
                :alt="item.label"
                :width="24"
                :height="24"
                format="webp"
                loading="lazy"
                custom
                class="aspect-square size-6 shrink-0 rounded-md object-cover"
            >
                <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                <USkeleton
                    v-else
                    class="aspect-square size-6 shrink-0 rounded-md"
                />
            </NuxtImg>
            <div class="flex w-full cursor-pointer items-center gap-2">
                <span
                    class="text-toned line-clamp-1 grow text-left text-xs leading-none"
                >
                    {{ item.label }}
                </span>
                <span
                    class="text-muted line-clamp-1 text-xs leading-none break-all"
                >
                    {{ item.shop }}
                </span>
            </div>
        </template>
    </UCommandPalette>
</template>
