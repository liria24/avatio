<script setup lang="ts">
const emit = defineEmits<{
    select: [item: CatalogItemView]
}>()

const props = defineProps<{
    loading?: boolean
}>()

const searchTerm = ref('')
const loadingRef = ref(false)
const { t } = useI18n()

const itemCategory = useItemCategory()
const toast = useToast()

const { data, status } = useFetch('/api/items', {
    query: {
        limit: 1000,
    },
    dedupe: 'defer',
    transform: (data) => {
        return itemCategorySchema.options.map((category) => ({
            id: category,
            label: itemCategory[category].label,
            items: data.data
                .filter((item) => item.category === category)
                .map((item) => ({
                    id: item.id,
                    label: item.name,
                    publisher: item.primarySource?.publisher?.name,
                    image: item.image,
                    slot: 'item' as const,
                })),
        }))
    },
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause === 'refresh:manual'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const groups = computed(() => {
    try {
        new URL(searchTerm.value)

        if (searchTerm.value.length) {
            return [
                {
                    id: 'search',
                    label: t('commandPalette.itemSearch.addFromUrl'),
                    items: [
                        {
                            id: 'url',
                            label: searchTerm.value,
                            slot: 'url',
                            onSelect: () => onSelected(searchTerm.value, true),
                        },
                    ],
                },
                ...(data.value?.map((category) => ({
                    ...category,
                    items: category.items.map((item) => ({
                        ...item,
                        onSelect: () => onSelected(item.id),
                    })),
                })) || []),
            ]
        }
        return (
            data.value?.map((category) => ({
                ...category,
                items: category.items.map((item) => ({
                    ...item,
                    onSelect: () => onSelected(item.id),
                })),
            })) || []
        )
    } catch {
        return (
            data.value?.map((category) => ({
                ...category,
                items: category.items.map((item) => ({
                    ...item,
                    onSelect: () => onSelected(item.id),
                })),
            })) || []
        )
    }
})

const loadingComputed = computed(
    () => props.loading || loadingRef.value || status.value === 'pending',
)

const onSelected = async (id: string, resolve = false) => {
    loadingRef.value = true

    try {
        const response = resolve
            ? await $fetch<CatalogItemView>('/api/items/resolve', {
                  method: 'POST',
                  body: { reference: id },
              })
            : await $fetch<CatalogItemView>(`/api/items/${encodeURIComponent(id)}`)
        emit('select', response)
        searchTerm.value = ''
    } catch (error) {
        console.error('Failed to fetch item:', error)
        toast.add({
            title: t('commandPalette.itemSearch.fetchError'),
            description: t('commandPalette.itemSearch.fetchErrorDescription'),
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
        v-model:search-term="searchTerm"
        virtualize
        :loading="loadingComputed"
        :placeholder="$t('commandPalette.itemSearch.placeholder')"
        :groups="groups"
        :ui="{
            root: 'min-w-72 md:min-w-96',
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    >
        <template #item="{ item }">
            <NuxtImg
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="item.image"
                :width="24"
                :height="24"
                format="avif"
                custom
            >
                <img
                    v-if="isLoaded"
                    v-bind="imgAttrs"
                    :src
                    :alt="item.label"
                    loading="lazy"
                    fetchpriority="low"
                    class="aspect-square size-6 shrink-0 rounded-md object-cover"
                />
                <USkeleton v-else class="aspect-square size-6 shrink-0 rounded-md" />
            </NuxtImg>
            <div class="flex w-full cursor-pointer items-center gap-2">
                <span class="text-toned line-clamp-1 grow text-left text-xs">
                    {{ item.label }}
                </span>
                <span class="text-muted line-clamp-1 text-xs leading-none break-all">
                    {{ item.publisher }}
                </span>
            </div>
        </template>
    </UCommandPalette>
</template>
