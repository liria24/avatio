import type { SetupComposeForm } from '@avatio/core/setups'
import type { Ref } from 'vue'

export type SetupComposeEntry = SetupComposeForm['items'][number] & {
    id: string
    platform: Platform | null
    name: string
    image: string | null
}

export const useSetupComposeEntries = (
    items: Readonly<Ref<SetupComposeForm['items']>>,
    setItems: (items: SetupComposeForm['items']) => void,
    entities: Ref<Record<string, Item>>,
) => {
    const toast = useToast()
    const { t } = useI18n()
    const entries = computed<SetupComposeEntry[]>(() =>
        items.value.map((item) => ({
            ...(entities.value[item.itemId] ?? {
                id: item.itemId,
                platform: null,
                name: item.itemId,
                image: null,
            }),
            ...item,
            id: item.itemId,
        })),
    )
    const totalItemsCount = computed(() => items.value.length)

    const addItem = (item: Item) => {
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
                itemId: item.id,
                category: parsedCategory.success ? parsedCategory.data : 'other',
                note: '',
                unsupported: false,
                shapekeys: [],
            },
        ])
    }

    const updateItem = (itemId: string, update: Partial<SetupComposeForm['items'][number]>) =>
        setItems(
            items.value.map((item) => (item.itemId === itemId ? { ...item, ...update } : item)),
        )

    const removeItem = (category: ItemCategory, itemId: string) =>
        setItems(items.value.filter((item) => item.itemId !== itemId || item.category !== category))

    const changeItemCategory = (itemId: string, category: ItemCategory) => {
        if (itemCategorySchema.safeParse(category).success) updateItem(itemId, { category })
    }

    const addShapekey = (input: {
        category: ItemCategory
        id: string
        name: string
        value: number
    }) => {
        const item = items.value.find(
            ({ itemId, category }) => itemId === input.id && category === input.category,
        )
        if (item)
            updateItem(input.id, {
                shapekeys: [...item.shapekeys, { name: input.name, value: input.value }],
            })
    }

    const removeShapekey = (input: { category: ItemCategory; id: string; index: number }) => {
        const item = items.value.find(
            ({ itemId, category }) => itemId === input.id && category === input.category,
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
                    ? reordered.flatMap(({ itemId }) => {
                          const item = items.value.find((candidate) => candidate.itemId === itemId)
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
