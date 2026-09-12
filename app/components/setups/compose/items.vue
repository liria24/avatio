<script lang="ts" setup>
import type { SetupComposeEntry } from '~/composables/setupComposeEntries'

const itemCategory = useItemCategory()
const {
    entries,
    totalItemsCount,
    addItem,
    removeItem,
    changeItemCategory,
    addShapekey,
    removeShapekey,
    updateItem,
    reorderCategory,
    itemSearchTerm,
    itemScrollTop,
    values,
    openImagePoints,
} = useSetupCompose()
const list = ref<HTMLElement>()
const itemCategories = itemCategorySchema.options

const getItemsByCategory = (category: ItemCategory) =>
    entries.value.filter((entry) => entry.category === category)
const setItemsByCategory = (category: ItemCategory, next: SetupComposeEntry[]) =>
    reorderCategory(category, next)

const { data: suggestedItems } = await useFetch('/api/items/suggested', {
    query: { limit: 8 },
    dedupe: 'defer',
    default: () => [],
})

const restoreScroll = () => nextTick(() => list.value?.scrollTo({ top: itemScrollTop.value }))
onMounted(restoreScroll)
watch(totalItemsCount, (count, previous) => {
    if (count && !previous) void restoreScroll()
})
onBeforeUnmount(() => {
    itemScrollTop.value = list.value?.scrollTop ?? itemScrollTop.value
})
</script>

<template>
    <div class="contents">
        <div v-if="!totalItemsCount" class="m-auto flex flex-col items-center gap-6 text-center">
            <p class="text-xl">
                {{ $t('setup.compose.items.emptyPrompt') }}
            </p>

            <UFormField
                :help="$t('setup.compose.items.supportedPlatforms')"
                :ui="{ help: 'px-1 text-xs text-dimmed' }"
            >
                <CommandPaletteItemSearch
                    v-model:search-term="itemSearchTerm"
                    class="min-w-sm"
                    @select="addItem"
                />
            </UFormField>

            <div v-if="suggestedItems.length" class="flex max-w-md flex-wrap items-center gap-4">
                <UTooltip
                    v-for="item in suggestedItems"
                    :key="item.id"
                    :text="item.name"
                    :delay-duration="50"
                >
                    <button
                        type="button"
                        class="group relative cursor-pointer overflow-clip rounded-lg object-cover"
                        @click="addItem(item)"
                    >
                        <NuxtImg
                            v-if="item.image"
                            :src="item.image"
                            :alt="item.name"
                            width="80"
                            height="80"
                            class="size-20 object-cover"
                        />
                        <span v-else class="bg-muted grid size-20 place-items-center">
                            <Icon name="mingcute:package-2-fill" size="24" />
                        </span>
                        <span
                            class="absolute inset-0 grid place-items-center bg-white/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-black/60"
                        >
                            <Icon name="mingcute:add-line" size="24" class="text-highlighted" />
                        </span>
                        <span
                            class="ring-inverted/15 pointer-events-none absolute inset-0 rounded-lg ring-2"
                        />
                    </button>
                </UTooltip>
            </div>
        </div>

        <CommandPaletteItemSearch
            v-if="totalItemsCount"
            v-model:search-term="itemSearchTerm"
            class="w-full"
            @select="addItem"
        />

        <div
            v-if="totalItemsCount"
            ref="list"
            class="flex min-h-0 w-full grow scrollbar-thin scrollbar-thumb-(--ui-bg-accented) scrollbar-track-transparent flex-col gap-6 overflow-y-auto"
            @scroll="itemScrollTop = list?.scrollTop ?? 0"
        >
            <div
                v-for="category in itemCategories"
                :key="category"
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

                    <SortableList
                        :model-value="getItemsByCategory(category)"
                        handle=".draggable"
                        class="flex h-full w-full flex-col gap-2"
                        @update:model-value="setItemsByCategory(category, $event)"
                    >
                        <SetupsComposeItem
                            v-for="item in getItemsByCategory(category)"
                            :key="item.id"
                            :unsupported="item.unsupported"
                            :shapekeys="item.shapekeys"
                            :note="item.note"
                            :item="item"
                            :images="values.images"
                            class="m-0.5"
                            @change-category="changeItemCategory(item.id, $event)"
                            @remove-item="removeItem(item.category, item.id)"
                            @place-item="openImagePoints($event, item.id)"
                            @shapekey-add="addShapekey($event)"
                            @shapekey-remove="removeShapekey($event)"
                            @update:unsupported="updateItem(item.id, { unsupported: $event })"
                            @update:note="updateItem(item.id, { note: $event || '' })"
                        />
                    </SortableList>
                </template>
            </div>
        </div>

        <div class="flex w-full items-center justify-end gap-2">
            <div
                :data-exceeded="totalItemsCount > 32"
                class="ring-accented ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 data-[exceeded=true]:ring-red-500"
            >
                <Icon name="mingcute:package-2-fill" size="16" class="text-muted shrink-0" />
                <span class="font-mono text-xs leading-none text-nowrap">
                    <span>{{ totalItemsCount }}</span>
                    <span v-if="totalItemsCount > 32"> / 32</span>
                </span>
            </div>
        </div>
    </div>
</template>
