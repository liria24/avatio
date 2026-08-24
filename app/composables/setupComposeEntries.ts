import type { WritableComputedRef } from 'vue'
import type { z } from 'zod'

type EditorSchema = DeepNonNullable<z.infer<typeof setupsClientFormSchema>>
export type SetupComposeEntry = EditorSchema['entries'][number]

export const useSetupComposeEntries = (entries: WritableComputedRef<SetupComposeEntry[]>) => {
    const toast = useToast()
    const { t } = useI18n()
    const totalItemsCount = computed(() => entries.value.length)

    const isItemAlreadyAdded = (itemId: Item['id']) =>
        entries.value.some((item) => item.id === itemId)

    const addItem = (item: Item) => {
        if (!item?.id || !item?.category) {
            console.error('Invalid item data:', item)
            return
        }
        if (isItemAlreadyAdded(item.id)) {
            toast.add({
                id: 'item-duplicate',
                icon: 'mingcute:warning-line',
                title: t('setup.compose.itemAlreadyAdded'),
                color: 'warning',
            })
            return
        }

        const parsedCategory = itemCategorySchema.safeParse(item.category)
        const category = parsedCategory.success ? parsedCategory.data : 'other'
        if (!parsedCategory.success)
            console.warn('Invalid item category, using other:', item.category)

        entries.value.push({
            ...item,
            id: item.id.toString(),
            category,
            note: '',
            unsupported: false,
            image: item.image ?? '',
            niceName: item.niceName ?? '',
            price: item.price ?? '',
            likes: item.likes ?? 0,
            shop: item.shop ? { ...item.shop, image: item.shop.image ?? '' } : undefined,
        })
    }

    const removeItem = (category: ItemCategory, id: Item['id']) => {
        const index = entries.value.findIndex(
            (item) => item.id === id && item.category === category,
        )
        if (index !== -1) entries.value.splice(index, 1)
        else console.warn('Item not found:', id)
    }

    const changeItemCategory = (id: Item['id'], category: ItemCategory) => {
        if (!itemCategorySchema.safeParse(category).success) {
            console.error('Invalid new category:', category)
            return
        }
        const item = entries.value.find((entry) => entry.id === id)
        if (item) item.category = category
        else console.warn('Item not found:', id)
    }

    const findEntry = (category: ItemCategory, id: Item['id']) =>
        entries.value.find((item) => item.id === id && item.category === category)

    const addShapekey = (input: {
        category: ItemCategory
        id: Item['id']
        name: string
        value: number
    }) => {
        const item = findEntry(input.category, input.id)
        if (!item) {
            console.warn('Item not found:', input.id)
            return
        }
        item.shapekeys ??= []
        item.shapekeys.push({ name: input.name, value: input.value })
    }

    const removeShapekey = (input: { category: ItemCategory; id: Item['id']; index: number }) => {
        const item = findEntry(input.category, input.id)
        if (!item?.shapekeys || input.index < 0 || input.index >= item.shapekeys.length) {
            console.warn('Shapekey not found:', input.id, input.index)
            return
        }
        item.shapekeys.splice(input.index, 1)
    }

    return {
        totalItemsCount,
        addItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
    }
}
