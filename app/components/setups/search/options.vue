<script lang="ts" setup>
const open = defineModel<boolean>('open', {
    default: false,
})
const items = defineModel<string[]>('items', {
    default: [],
})
const tags = defineModel<string[]>('tags', {
    default: [],
})

const popoverItemSearch = ref(false)

const onSelectItemSearch = async (item: Partial<Item> & Pick<Item, 'id'>) => {
    if (!items.value.includes(item.id)) items.value.push(item.id)

    popoverItemSearch.value = false
}
</script>

<template>
    <UCollapsible
        v-model:open="open"
        class="data-[state=open]:bg-elevated flex flex-col rounded-lg"
    >
        <UButton
            label="詳細オプション"
            color="neutral"
            variant="ghost"
            size="sm"
            trailing-icon="i-lucide-chevron-down"
            :ui="{
                label: 'group-data-[state=open]:opacity-0 transition-opacity duration-200',
                trailingIcon:
                    'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            block
            class="group"
        />

        <template #content>
            <div class="flex w-full flex-col gap-3 rounded-lg p-4 pt-0">
                <!-- アイテム選択セクション -->
                <div class="flex w-full flex-col gap-2">
                    <div class="flex items-center gap-1">
                        <Icon name="mingcute:package-2-fill" size="18" class="text-muted" />
                        <h2 class="text-sm leading-none font-semibold text-nowrap">アイテム</h2>
                    </div>

                    <div class="flex w-full flex-wrap items-center gap-2">
                        <SetupsSearchOptionsItem
                            v-for="item in items"
                            :key="item"
                            :item-id="item.toString()"
                            class="bg-accented flex max-w-56 items-center gap-2 rounded-lg p-2"
                            @remove="items = items.filter((i) => i !== item)"
                        />

                        <UPopover v-model:open="popoverItemSearch">
                            <UButton
                                :label="items.length ? undefined : 'アイテムを選択'"
                                icon="mingcute:add-line"
                                aria-label="Add item"
                                variant="ghost"
                                class="p-4"
                            />

                            <template #content>
                                <CommandPaletteItemSearch @select="onSelectItemSearch" />
                            </template>
                        </UPopover>
                    </div>
                </div>

                <!-- タグ入力セクション -->
                <div class="flex w-full flex-col gap-1.5">
                    <div class="flex items-center gap-1">
                        <Icon name="mingcute:tag-2-fill" size="18" class="text-muted" />
                        <h2 class="text-sm leading-none font-semibold text-nowrap">タグ</h2>
                    </div>

                    <UInputTags
                        v-model="tags"
                        placeholder="タグを入力"
                        @add-tag="tags = [...tags, $event as string]"
                        @remove-tag="tags = tags.filter((tag) => tag !== $event)"
                    />
                </div>
            </div>
        </template>
    </UCollapsible>
</template>
