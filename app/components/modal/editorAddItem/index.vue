<script lang="ts" setup>
const vis = defineModel<boolean>({
    default: false,
})
const emit = defineEmits(['add'])

const ignoreCategories = ['hair', 'texture', 'tool']

const searchWord = ref<string>('')
const searchItems = ref<
    {
        id: number
        name: string
        thumbnail: string
        shop: string
        category: string
    }[]
>([])
const categoryFilter = ref<string[]>([])
const searching = ref<boolean>(false)

const client = useSupabaseClient()

const handleInputChange = useDebounceFn(
    async (value) => {
        searching.value = true

        if (!value.length) return (searching.value = false)

        const { data } = await client.rpc('search_items', {
            keyword: value.toString(),
            exclude_categories: categoryFilter.value.length
                ? Object.values(itemCategories())
                      .map((c) => c.id)
                      .filter((id) => !categoryFilter.value.includes(id))
                : [],
            num: 20,
        })
        searchItems.value = data ?? []

        searching.value = false
    },
    400,
    { maxWait: 1000 }
) // 400～1000ms デバウンス

const onClick = (key: string) => {
    if (categoryFilter.value.includes(key))
        categoryFilter.value = categoryFilter.value.filter((v) => v !== key)
    else categoryFilter.value = [...categoryFilter.value, key]
}

watch(searchWord, (newValue) => {
    handleInputChange(newValue)
})
watch(categoryFilter, () => {
    handleInputChange(searchWord.value)
})
watchEffect(() => {
    if (vis.value) {
        searchWord.value = ''
        searchItems.value = []
    }
})
</script>

<template>
    <Modal
        v-model="vis"
        :anchor="searchWord.length ? 'top' : 'center'"
        class="mt-12 rounded-none border-0 bg-transparent p-0 shadow-none transition-all dark:bg-transparent"
    >
        <ModalEditorAddItemUrl
            v-if="!searchWord.length"
            class="mb-3"
            @add="emit('add', $event)"
        />

        <ModalEditorAddItemSearch v-model="searchWord" />

        <div
            v-if="searchWord.length"
            class="flex shrink-0 items-center gap-1 overflow-x-auto overflow-y-visible p-1"
        >
            <template v-for="(value, key) in itemCategories()">
                <Button
                    v-if="!ignoreCategories.includes(key)"
                    :label="value.label"
                    :class="[
                        'rounded-full px-3 py-2',
                        key
                            ? categoryFilter.includes(key)
                                ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-500 dark:bg-zinc-300 dark:text-zinc-900 hover:dark:bg-zinc-400'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 hover:dark:bg-zinc-600'
                            : '',
                    ]"
                    @click="onClick(key)"
                />
            </template>
        </div>

        <ModalEditorAddItemSearchedItems
            v-if="searchWord.length"
            v-model:items="searchItems"
            v-model:searching="searching"
            @add="emit('add', $event)"
        />
    </Modal>
</template>
