<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'
import { VueDraggable } from 'vue-draggable-plus'

const props = defineProps<{ class?: string | string[] }>()
const emit = defineEmits(['undo', 'redo'])

const toast = useToast()

const items = defineModel<Record<ItemCategory, SetupItem[]>>({
    default: {
        avatar: [],
        cloth: [],
        accessory: [],
        hair: [],
        texture: [],
        shader: [],
        tool: [],
        other: [],
    },
})

const modalSearchItem = ref(false)

const addItem = async (id: number) => {
    const data = await useFetchBooth(id)

    // outdated === true だった場合に、細かくエラーの理由を説明するほうが、
    // ユーザーが何回も追加を試さなくてもよくなりそう

    if (!data)
        return toast.add({
            title: 'アイテムの追加に失敗しました。',
            color: 'error',
        })

    const d: SetupItem = {
        ...data,
        shapekeys: [],
        note: '',
        unsupported: false,
    }

    const categoryKey = data.category in items.value ? data.category : 'other'
    const target = items.value[categoryKey]

    if (target.some((i) => i.id === id))
        toast.add({
            title: '同じアイテムを重複して登録することはできません。',
            color: 'warning',
        })
    else {
        target.push(d)
        modalSearchItem.value = false
    }
}

const changeCategory = (item: SetupItem, category: ItemCategory) => {
    items.value[item.category] = items.value[item.category].filter(
        (i) => i.id !== item.id
    )
    item.category = category
    items.value[category].push(item)
}

const removeItem = (id: number) => {
    for (const key in items.value)
        if (Object.prototype.hasOwnProperty.call(items.value, key))
            items.value[key as ItemCategory] = items.value[
                key as ItemCategory
            ].filter((item) => item.id !== id)
}

const totalItemsCount = computed(() =>
    Object.values(items.value).reduce((total, arr) => total + arr.length, 0)
)
</script>

<template>
    <div
        :class="
            twMerge('relative flex flex-col items-center gap-8', props.class)
        "
    >
        <div class="flex w-full flex-col items-stretch gap-4">
            <div class="flex items-center gap-2">
                <div class="flex grow items-center gap-1">
                    <Button
                        icon="lucide:undo-2"
                        variant="flat"
                        class="size-9"
                        @click="emit('undo')"
                    />
                    <Button
                        icon="lucide:redo-2"
                        variant="flat"
                        class="size-9"
                        @click="emit('redo')"
                    />

                    <div
                        :data-exceeded="totalItemsCount > 32"
                        class="ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 ring-zinc-500 data-[exceeded=true]:ring-red-500"
                    >
                        <Icon
                            name="lucide:box"
                            size="16"
                            class="shrink-0 text-zinc-600 dark:text-zinc-400"
                        />
                        <span
                            class="pt-px font-[Geist] text-xs leading-none whitespace-nowrap"
                        >
                            <span>{{ totalItemsCount }}</span>
                            <span v-if="totalItemsCount > 32">/ 32</span>
                        </span>
                    </div>
                </div>

                <Button
                    class="rounded-full pr-4.5 pl-4"
                    @click="modalSearchItem = true"
                >
                    <Icon name="lucide:plus" :size="18" class="text-zinc-400" />
                    <span
                        class="text-sm leading-none font-medium sm:before:content-['アバター・']"
                    >
                        アイテムを追加
                    </span>
                </Button>
            </div>
        </div>

        <div
            v-if="!totalItemsCount"
            class="flex h-full flex-col items-center justify-center gap-6"
        >
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
                アイテムが登録されていません
            </p>
            <SetupsEditItemsOwnedAvatar @add="addItem" />
        </div>

        <div
            v-else
            class="absolute inset-0 mt-16 flex flex-col gap-5 overflow-y-auto p-1"
        >
            <div
                v-for="(value, key) in items"
                :key="'category-' + key"
                class="flex w-full flex-col gap-3 empty:hidden"
            >
                <template v-if="value.length">
                    <UiTitle
                        :label="itemCategories()[key].label"
                        :icon="itemCategories()[key].icon"
                    />

                    <VueDraggable
                        v-model="items[key]"
                        :animation="150"
                        handle=".draggable"
                        drag-class="opacity-100"
                        ghost-class="opacity-0"
                        class="flex flex-col gap-2"
                    >
                        <SetupsEditItemsItem
                            v-for="item in value"
                            v-model:note="item.note"
                            v-model:unsupported="item.unsupported"
                            v-model:shapekeys="item.shapekeys"
                            :key="'item-' + item.id"
                            :size="item.category === 'avatar' ? 'lg' : 'md'"
                            :item="item"
                            @change-category="changeCategory(item, $event)"
                            @remove="removeItem(item.id)"
                        />
                    </VueDraggable>
                </template>
            </div>
        </div>
    </div>

    <ModalEditorAddItem v-model="modalSearchItem" @add="addItem" />
</template>
