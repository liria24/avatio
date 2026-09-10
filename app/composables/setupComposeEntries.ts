import type { SetupComposeForm } from '@avatio/core/setups'
import type { Ref } from 'vue'

export type SetupComposeEntry = SetupComposeForm['items'][number] & {
    id: string
    primarySource: CatalogItemView['primarySource']
    name: string
    image: string | null
}

export const useSetupComposeEntries = (
    items: Readonly<Ref<SetupComposeForm['items']>>,
    setItems: (items: SetupComposeForm['items']) => void,
    entities: Ref<Record<string, CatalogItemView>>,
) => {
    const toast = useToast()
    const { t } = useI18n()
    const entries = computed<SetupComposeEntry[]>(() =>
        items.value.map((item) => {
            const id = item.id ?? item.itemId
            return {
                ...(entities.value[item.itemId] ?? {
                    id: item.itemId,
                    primarySource: null,
                    name: item.itemId,
                    image: null,
                }),
                ...item,
                id,
            }
        }),
    )
    const totalItemsCount = computed(() => items.value.length)

    const addItem = (item: CatalogItemView) => {
        if (!item?.id || !item?.category) {
            console.error('Invalid item data:', item)
            return
        }
        if (items.value.some(({ itemId }) => itemId === item.id)) {
            toast.add({
                id: 'item-duplicate',
                icon: 'mingcute:warning-line',
                title: t('setup.compose.itemAlreadyAdded'),
                color: 'warning',
            })
            return
        }

        const parsedCategory = itemCategorySchema.safeParse(item.category)
        entities.value = { ...entities.value, [item.id]: item }
        setItems([
            ...items.value,
            {
                id: crypto.randomUUID(),
                itemId: item.id,
                category: parsedCategory.success ? parsedCategory.data : 'other',
                note: '',
                unsupported: false,
                shapekeys: [],
            },
        ])
    }

    const updateItem = (entryId: string, update: Partial<SetupComposeForm['items'][number]>) =>
        setItems(
            items.value.map((item) =>
                (item.id ?? item.itemId) === entryId ? { ...item, ...update } : item,
            ),
        )

    const removeItem = (category: ItemCategory, entryId: string) =>
        setItems(
            items.value.filter(
                (item) => (item.id ?? item.itemId) !== entryId || item.category !== category,
            ),
        )

    const changeItemCategory = (entryId: string, category: ItemCategory) => {
        if (itemCategorySchema.safeParse(category).success) updateItem(entryId, { category })
    }

    const addShapekey = (input: {
        category: ItemCategory
        id: string
        name: string
        value: number
    }) => {
        const item = items.value.find(
            (item) => (item.id ?? item.itemId) === input.id && item.category === input.category,
        )
        if (item)
            updateItem(input.id, {
                shapekeys: [...item.shapekeys, { name: input.name, value: input.value }],
            })
    }

    const removeShapekey = (input: { category: ItemCategory; id: string; index: number }) => {
        const item = items.value.find(
            (item) => (item.id ?? item.itemId) === input.id && item.category === input.category,
        )
        if (item)
            updateItem(input.id, {
                shapekeys: item.shapekeys.filter((_, index) => index !== input.index),
            })
    }

    const reorderCategory = (category: ItemCategory, reordered: SetupComposeEntry[]) => {
        const byCategory = Object.fromEntries(
            itemCategorySchema.options.map((key) => [
                key,
                key === category
                    ? reordered.flatMap(({ id }) => {
                          const item = items.value.find(
                              (candidate) => (candidate.id ?? candidate.itemId) === id,
                          )
                          return item ? [item] : []
                      })
                    : items.value.filter((item) => item.category === key),
            ]),
        ) as Record<ItemCategory, SetupComposeForm['items']>
        setItems(itemCategorySchema.options.flatMap((key) => byCategory[key]))
    }

    return {
        entries,
        totalItemsCount,
        addItem,
        updateItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        reorderCategory,
    }
}
