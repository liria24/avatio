<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';
import { VueDraggable } from 'vue-draggable-plus';

const { class: propClass } = defineProps<{ class?: string | string[] }>();
const emit = defineEmits(['undo', 'redo']);

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
});

const modalSearchItem = ref(false);

const addItem = async (id: number) => {
    const data = await useFetchBooth(id);

    // outdated === true だった場合に、細かくエラーの理由を説明するほうが、
    // ユーザーが何回も追加を試さなくてもよくなりそう

    if (!data) return useToast().add('アイテムの追加に失敗しました。');

    const d: SetupItem = {
        ...data,
        shapekeys: [],
        note: '',
        unsupported: false,
    };

    const categoryKey = data.category in items.value ? data.category : 'other';
    const target = items.value[categoryKey];

    if (target.some((i) => i.id === id))
        useToast().add('同じアイテムを重複して登録することはできません。');
    else {
        target.push(d);
        modalSearchItem.value = false;
    }
};

const changeCategory = (item: SetupItem, category: ItemCategory) => {
    items.value[item.category] = items.value[item.category].filter(
        (i) => i.id !== item.id
    );
    item.category = category;
    items.value[category].push(item);
};

const removeItem = (id: number) => {
    for (const key in items.value)
        if (Object.prototype.hasOwnProperty.call(items.value, key))
            items.value[key as ItemCategory] = items.value[
                key as ItemCategory
            ].filter((item) => item.id !== id);
};

const totalItemsCount = computed(() =>
    Object.values(items.value).reduce((total, arr) => total + arr.length, 0)
);
</script>

<template>
    <div
        :class="twMerge('relative flex-col items-center gap-8 flex', propClass)"
    >
        <div class="w-full flex flex-col gap-4 items-stretch">
            <div class="gap-2 flex items-center">
                <div class="grow gap-1 flex items-center">
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
                        class="ml-1 pl-2.5 pr-3 py-1 rounded-full flex gap-1.5 items-center ring-1 ring-zinc-500 data-[exceeded=true]:ring-red-500"
                    >
                        <Icon
                            name="lucide:box"
                            size="16"
                            class="shrink-0 text-zinc-600 dark:text-zinc-400"
                        />
                        <span class="text-xs leading-none whitespace-nowrap">
                            <span>{{ totalItemsCount }}</span>
                            <span v-if="totalItemsCount > 32">/ 32</span>
                        </span>
                    </div>
                </div>

                <Button
                    icon="lucide:plus"
                    label="アバター・アイテムを追加"
                    class="pl-4 pr-4.5 rounded-full"
                    @click="modalSearchItem = true"
                />
            </div>
        </div>

        <div
            v-if="!totalItemsCount"
            class="h-full flex flex-col gap-6 items-center justify-center"
        >
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
                アイテムが登録されていません
            </p>
            <SetupsEditItemsOwnedAvatar @add="addItem" />
        </div>

        <div
            v-else
            class="absolute inset-0 mt-16 p-1 flex flex-col gap-5 overflow-y-auto"
        >
            <div
                v-for="(value, key) in items"
                :key="'category-' + key"
                class="empty:hidden w-full flex flex-col gap-3"
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
