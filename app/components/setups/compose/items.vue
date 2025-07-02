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

const toast = useToast()
const categoryAttributes = itemCategoryAttributes()

const inputShapekeyName = ref('')
const inputShapekeyValue = ref(0)
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

const ownedAvatars = ref<Item[]>([])

try {
    const avatarsData = await $fetch<Item[]>('/api/item/owned-avatars', {
        query: { limit: 10 },
    })
    ownedAvatars.value = avatarsData || []
} catch (error) {
    console.error('Failed to fetch owned avatars:', error)
}

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

    if (index !== -1) {
        categoryItems.splice(index, 1)
        console.log('Item removed successfully')
    } else {
        console.error('Item not found for removal:', id)
    }
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
                console.log('Item category changed successfully')
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

    inputShapekeyName.value = ''
    inputShapekeyValue.value = 0
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
                        width="24"
                        height="24"
                        format="webp"
                        class="aspect-square size-6 shrink-0 rounded-md object-cover"
                    />
                    <span class="text-toned text-xs">
                        {{ avatarShortName(ownedAvatar.name) }}
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
                            :name="
                                categoryAttributes[category]?.icon ||
                                'lucide:box'
                            "
                            :size="22"
                            class="text-muted shrink-0"
                        />
                        <h2
                            class="pb-0.5 text-lg leading-none font-semibold text-nowrap"
                        >
                            {{
                                categoryAttributes[category]?.label || category
                            }}
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
                        <div
                            v-for="item in items[category]"
                            :key="`item-${item.id}`"
                            class="ring-accented flex items-start gap-2 rounded-md p-2 ring-1"
                        >
                            <div
                                class="draggable hover:bg-elevated grid h-full cursor-move rounded-md px-1 py-2 transition-colors"
                            >
                                <Icon
                                    name="lucide:grip-vertical"
                                    size="18"
                                    class="text-muted shrink-0 self-center"
                                />
                            </div>

                            <div class="flex grow flex-col gap-2">
                                <div class="flex items-start gap-1">
                                    <NuxtImg
                                        v-slot="{ isLoaded, src, imgAttrs }"
                                        :src="item.image || undefined"
                                        :alt="item.name"
                                        :width="72"
                                        :height="72"
                                        format="webp"
                                        custom
                                    >
                                        <img
                                            v-if="isLoaded"
                                            v-bind="imgAttrs"
                                            :src="src"
                                            class="aspect-square size-18 shrink-0 rounded-lg object-cover"
                                        />
                                        <USkeleton
                                            v-else
                                            class="aspect-square size-18 shrink-0 rounded-lg"
                                        />
                                    </NuxtImg>

                                    <div
                                        class="flex grow flex-col gap-2 self-center pl-2"
                                    >
                                        <div class="flex items-center gap-2">
                                            <UTooltip
                                                v-if="item.platform === 'booth'"
                                                text="BOOTH"
                                                :delay-duration="50"
                                            >
                                                <Icon
                                                    name="avatio:booth"
                                                    size="16"
                                                    class="text-muted shrink-0"
                                                />
                                            </UTooltip>
                                            <p class="text-toned text-sm">
                                                {{ item.name }}
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <UPopover>
                                                <UButton
                                                    :label="`シェイプキー: ${item.shapekeys?.length || 0}`"
                                                    variant="subtle"
                                                    size="sm"
                                                />

                                                <template #content>
                                                    <div
                                                        class="flex flex-col items-center gap-2 p-2"
                                                    >
                                                        <p
                                                            v-if="
                                                                !item.shapekeys
                                                                    ?.length
                                                            "
                                                            class="text-muted p-3 text-sm"
                                                        >
                                                            シェイプキーがありません
                                                        </p>
                                                        <template v-else>
                                                            <div
                                                                v-for="(
                                                                    shapekey,
                                                                    index
                                                                ) in item.shapekeys"
                                                                :key="`shapekey-${index}`"
                                                                class="flex w-full items-center gap-3"
                                                            >
                                                                <span
                                                                    class="text-muted grow text-right text-sm"
                                                                >
                                                                    {{
                                                                        shapekey.name
                                                                    }}
                                                                </span>
                                                                <span
                                                                    class="text-toned text-sm font-semibold"
                                                                >
                                                                    {{
                                                                        shapekey.value
                                                                    }}
                                                                </span>
                                                                <UButton
                                                                    icon="lucide:x"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    @click="
                                                                        removeShapekey(
                                                                            {
                                                                                category:
                                                                                    item.category,
                                                                                id: item.id,
                                                                                index,
                                                                            }
                                                                        )
                                                                    "
                                                                />
                                                            </div>
                                                        </template>
                                                        <div
                                                            class="flex items-center gap-1"
                                                        >
                                                            <UInput
                                                                v-model="
                                                                    inputShapekeyName
                                                                "
                                                                placeholder="シェイプキー名称"
                                                                size="sm"
                                                                class="max-w-48"
                                                            />
                                                            <UInputNumber
                                                                v-model="
                                                                    inputShapekeyValue
                                                                "
                                                                :step="0.001"
                                                                orientation="vertical"
                                                                size="sm"
                                                                class="max-w-32"
                                                            />
                                                            <UButton
                                                                icon="lucide:plus"
                                                                variant="soft"
                                                                size="sm"
                                                                @click="
                                                                    addShapekey(
                                                                        {
                                                                            category:
                                                                                item.category,
                                                                            id: item.id,
                                                                            name: inputShapekeyName,
                                                                            value: inputShapekeyValue,
                                                                        }
                                                                    )
                                                                "
                                                            />
                                                        </div>
                                                    </div>
                                                </template>
                                            </UPopover>

                                            <UCheckbox
                                                v-if="
                                                    item.category !== 'avatar'
                                                "
                                                v-model="item.unsupported"
                                                label="ベースアバターに非対応"
                                                size="sm"
                                            />
                                        </div>
                                    </div>

                                    <UDropdownMenu
                                        :items="
                                            Object.entries(
                                                categoryAttributes
                                            ).map(([key, value]) => ({
                                                label: value.label,
                                                icon: value.icon,
                                                value: key,
                                                onSelect: () =>
                                                    changeItemCategory(
                                                        item.id,
                                                        key as ItemCategory
                                                    ),
                                            }))
                                        "
                                        :content="{
                                            align: 'center',
                                            side: 'bottom',
                                            sideOffset: 8,
                                        }"
                                        :ui="{ content: 'w-40' }"
                                    >
                                        <UButton
                                            :icon="
                                                categoryAttributes[
                                                    item.category
                                                ]?.icon || 'lucide:box'
                                            "
                                            variant="ghost"
                                            size="sm"
                                        />
                                    </UDropdownMenu>

                                    <UButton
                                        icon="lucide:x"
                                        variant="ghost"
                                        size="sm"
                                        @click="
                                            removeItem(item.category, item.id)
                                        "
                                    />
                                </div>

                                <UTextarea
                                    v-model="item.note"
                                    placeholder="ノートの追加"
                                    autoresize
                                    size="sm"
                                    :rows="1"
                                    variant="soft"
                                    class="w-full"
                                />
                            </div>
                        </div>
                    </VueDraggable>
                </template>
            </div>
        </div>
    </div>
</template>
