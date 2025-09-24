<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

const items = defineModel<Record<ItemCategory, SetupItem[]>>({
    default: () => ({
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    }),
})

const { itemCategory } = useAppConfig()
const toast = useToast()

const popoverItemSearch = ref(false)

type ItemsState = typeof items.value
type CategoryKey = keyof ItemsState

const itemCategories = Object.keys(items.value) as CategoryKey[]

const totalItemsCount = computed(() =>
    Object.values(items.value).reduce(
        (total, category) => total + category.length,
        0
    )
)

const getItemsByCategory = (category: CategoryKey) => items.value[category]

const { data: ownedAvatars } = await useFetch('/api/items/owned-avatars', {
    query: { limit: 10 },
    default: () => [],
})

const isItemAlreadyAdded = (itemId: string): boolean =>
    itemCategories.some((category) =>
        items.value[category].some((item) => item.id === itemId)
    )

const addItem = async (item: Item) => {
    if (!item?.id || !item?.category) {
        console.error('Invalid item data')
        return
    }

    if (isItemAlreadyAdded(item.id)) {
        toast.add({
            title: 'アイテムはすでに追加されています',
            color: 'warning',
        })
        return
    }

    const itemCategory = item.category as CategoryKey
    if (!(itemCategory in items.value)) {
        console.error('Invalid item category:', itemCategory)
        return
    }

    items.value[itemCategory].push({
        ...item,
        id: item.id.toString(),
        note: '',
        unsupported: false,
    })

    popoverItemSearch.value = false
}

const removeItem = (category: string, id: string) => {
    const categoryKey = category as CategoryKey
    if (!(categoryKey in items.value)) {
        console.error('Invalid category for removal:', category)
        return
    }

    const categoryItems = items.value[categoryKey]
    const index = categoryItems.findIndex((item) => item.id === id)

    if (index !== -1) categoryItems.splice(index, 1)
    else console.error('Item not found for removal:', id)
}

const changeItemCategory = (id: string, newCategory: ItemCategory) => {
    const newCategoryKey = newCategory as CategoryKey
    if (!(newCategoryKey in items.value)) {
        console.error('Invalid new category:', newCategory)
        return
    }

    for (const category of itemCategories) {
        const categoryItems = items.value[category]
        const index = categoryItems.findIndex((item) => item.id === id)

        if (index !== -1) {
            const [item] = categoryItems.splice(index, 1)
            if (item) {
                item.category = newCategory
                items.value[newCategoryKey].push(item)
                return
            }
        }
    }

    console.error('Item not found for category change:', id)
}

const addShapekey = (options: {
    category: string
    id: string
    name: string
    value: number
}) => {
    const { category, id, name, value } = options
    const categoryKey = category as CategoryKey

    if (!(categoryKey in items.value)) {
        console.error('Invalid category for shapekey addition:', category)
        return
    }

    const item = items.value[categoryKey].find((item) => item.id === id)
    if (!item) {
        console.error('Item not found for shapekey addition:', id)
        return
    }

    if (!item.shapekeys) item.shapekeys = []

    item.shapekeys.push({ name, value })
}

const removeShapekey = (options: {
    category: string
    id: string
    index: number
}) => {
    const { category, id, index } = options

    const categoryKey = category as CategoryKey

    if (!(categoryKey in items.value)) {
        console.error('Invalid category for shapekey removal:', category)
        return
    }

    const item = items.value[categoryKey].find((item) => item.id === id)
    if (!item?.shapekeys || index < 0 || index >= item.shapekeys.length) {
        console.error('Shapekey not found for removal:', id, index)
        return
    }

    item.shapekeys.splice(index, 1)
}
</script>

<template>
    <div class="relative flex h-full flex-col items-center gap-8">
        <div class="flex w-full flex-col items-stretch gap-4">
            <div class="flex items-center gap-2">
                <div class="flex grow items-center gap-1">
                    <div
                        :data-exceeded="totalItemsCount > 32"
                        class="ring-accented ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 data-[exceeded=true]:ring-red-500"
                    >
                        <Icon
                            name="lucide:box"
                            size="16"
                            class="text-muted shrink-0"
                        />
                        <span
                            class="pt-px font-[Geist] text-xs leading-none text-nowrap"
                        >
                            <span>{{ totalItemsCount }}</span>
                            <span v-if="totalItemsCount > 32"> / 32</span>
                        </span>
                    </div>
                </div>

                <UPopover
                    v-model:open="popoverItemSearch"
                    :content="{ side: 'bottom', align: 'end' }"
                    :ui="{ content: 'max-w-96' }"
                >
                    <UButton
                        icon="lucide:plus"
                        label="アイテムを追加"
                        variant="soft"
                        color="neutral"
                    />

                    <template #content>
                        <CommandPaletteItemSearch @select="addItem" />
                    </template>
                </UPopover>
            </div>
        </div>

        <div
            v-if="!totalItemsCount"
            class="flex h-full flex-col items-center justify-center gap-6 pb-8"
        >
            <p class="text-muted text-sm">アイテムが登録されていません</p>

            <div class="flex flex-wrap items-center justify-center gap-2">
                <UButton
                    v-for="ownedAvatar in ownedAvatars"
                    :key="`owned-avatar-${ownedAvatar.id}`"
                    variant="soft"
                    @click="addItem(ownedAvatar)"
                >
                    <NuxtImg
                        :src="ownedAvatar.image || undefined"
                        :alt="ownedAvatar.name"
                        :width="24"
                        :height="24"
                        format="webp"
                        loading="lazy"
                        fetchpriority="low"
                        class="aspect-square size-6 shrink-0 rounded-md object-cover"
                    />
                    <span class="text-toned text-xs">
                        {{
                            ownedAvatar.niceName ||
                            avatarShortName(ownedAvatar.name)
                        }}
                    </span>
                </UButton>
            </div>
        </div>

        <div
            v-else
            class="absolute inset-0 mt-10 flex flex-col gap-6 overflow-y-auto p-1"
        >
            <div
                v-for="category in itemCategories"
                :key="`item-category-${category}`"
                class="flex flex-col gap-4 empty:hidden"
            >
                <template v-if="getItemsByCategory(category).length">
                    <div class="flex items-center gap-2">
                        <Icon
                            :name="itemCategory[category]?.icon || 'lucide:box'"
                            :size="22"
                            class="text-muted shrink-0"
                        />
                        <h2
                            class="pb-0.5 text-lg leading-none font-semibold text-nowrap"
                        >
                            {{ itemCategory[category]?.label || category }}
                        </h2>
                    </div>

                    <VueDraggable
                        v-model="items[category]"
                        :animation="150"
                        handle=".draggable"
                        drag-class="opacity-100"
                        ghost-class="opacity-0"
                        class="flex h-full w-full flex-col gap-2"
                    >
                        <SetupsComposeItem
                            v-for="item in items[category]"
                            :key="`item-${item.id}`"
                            v-model:unsupported="item.unsupported"
                            v-model:shapekeys="item.shapekeys"
                            v-model:note="item.note"
                            :item="item"
                            @change-category="
                                changeItemCategory(item.id, $event)
                            "
                            @remove-item="removeItem(item.category, item.id)"
                            @shapekey-add="addShapekey($event)"
                            @shapekey-remove="removeShapekey($event)"
                        />
                    </VueDraggable>
                </template>
            </div>
        </div>
    </div>
</template>
