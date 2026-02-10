<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

const itemCategory = useItemCategory()
const {
    state,
    totalItemsCount,
    addItem: add,
    removeItem,
    changeItemCategory,
    addShapekey,
    removeShapekey,
} = useSetupCompose()

const popoverItemSearch = ref(false)

type ItemsState = typeof state.value.items
type CategoryKey = keyof ItemsState

const itemCategories = Object.keys(state.value.items) as CategoryKey[]

const getItemsByCategory = (category: CategoryKey) => state.value.items[category]

const { data: ownedAvatars } = await useFetch('/api/items/owned-avatars', {
    query: { limit: 10 },
    dedupe: 'defer',
    default: () => [],
})

const addItem = async (item: Item) => {
    add(item)
    popoverItemSearch.value = false
}
</script>

<template>
    <div class="relative flex flex-col items-center gap-8 lg:h-full">
        <div class="flex w-full flex-col items-stretch gap-4">
            <div class="flex items-center gap-2">
                <div class="flex grow items-center gap-1">
                    <div
                        :data-exceeded="totalItemsCount > 32"
                        class="ring-accented ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 data-[exceeded=true]:ring-red-500"
                    >
                        <Icon name="mingcute:box-3-fill" size="16" class="text-muted shrink-0" />
                        <span class="font-mono text-xs leading-none text-nowrap">
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
                        icon="mingcute:add-line"
                        :label="$t('setup.compose.items.add')"
                        variant="soft"
                        color="neutral"
                    />

                    <template #content>
                        <CommandPaletteItemSearch @select="addItem" />
                    </template>
                </UPopover>
            </div>
        </div>

        <UEmpty
            v-if="!totalItemsCount"
            :title="$t('setup.compose.items.empty')"
            variant="naked"
            :actions="
                ownedAvatars.map((ownedAvatar) => ({
                    label: ownedAvatar.niceName || avatarShortName(ownedAvatar.name),
                    avatar: { src: ownedAvatar.image || undefined },
                    variant: 'soft',
                    ui: {
                        label: 'whitespace-normal line-clamp-1',
                        leadingAvatar: 'rounded-md',
                    },
                    onClick: () => addItem(ownedAvatar),
                }))
            "
            class="lg:mt-[30cqh] lg:p-0"
        />

        <div
            v-else
            class="flex w-full flex-col gap-6 overflow-y-auto p-1 lg:absolute lg:inset-0 lg:mt-10"
        >
            <div
                v-for="category in itemCategories"
                :key="`item-category-${category}`"
                class="flex flex-col gap-4 empty:hidden"
            >
                <template v-if="getItemsByCategory(category).length">
                    <div class="flex items-center gap-2">
                        <Icon
                            :name="itemCategory[category]?.icon || 'mingcute:box-3-fill'"
                            :size="22"
                            class="text-muted shrink-0"
                        />
                        <h2 class="text-toned font-mono leading-none font-semibold text-nowrap">
                            {{ itemCategory[category]?.label || category }}
                        </h2>
                    </div>

                    <VueDraggable
                        v-model="state.items[category]"
                        :animation="150"
                        handle=".draggable"
                        drag-class="opacity-100"
                        ghost-class="opacity-0"
                        class="flex h-full w-full flex-col gap-2"
                    >
                        <SetupsComposeItem
                            v-for="item in state.items[category]"
                            :key="`item-${item.id}`"
                            v-model:unsupported="item.unsupported"
                            v-model:shapekeys="item.shapekeys"
                            v-model:note="item.note"
                            :item="item"
                            @change-category="changeItemCategory(item.id, $event)"
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
