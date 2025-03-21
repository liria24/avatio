<script lang="ts" setup>
const emit = defineEmits(['remove', 'changeCategory']);

const unsupported = defineModel<boolean>('unsupported', {
    default: false,
});

const windowClass = [
    'min-w-[220px] ring-1 ring-zinc-300 dark:ring-zinc-700 bg-zinc-100 dark:bg-zinc-900 rounded-md p-2',
    'shadow-lg shadow-black/20 dark:shadow-black/50',
    'data-[side=bottom]:mx-2 data-[side=bottom]:mb-2',
];
const buttonClass = [
    'cursor-pointer',
    'p-2 rounded-lg flex gap-2 items-center justify-start',
    'text-sm font-semibold align-middle leading-0',
    'bg-transparent dark:bg-transparent hover:bg-zinc-200 dark:hover:bg-zinc-600',
    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-600 dark:focus-visible:ring-zinc-400',
    'transition duration-100 ease-in-out',
];
</script>

<template>
    <DropdownMenuRoot>
        <DropdownMenuTrigger :class="buttonClass">
            <Icon
                name="lucide:menu"
                size="18"
                class="text-zinc-700 dark:text-zinc-300"
            />
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
            <DropdownMenuContent :class="windowClass" :side-offset="5">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger :class="buttonClass">
                        <DropdownMenuItemIndicator
                            class="absolute left-0 w-[25px] inline-flex items-center justify-center"
                        >
                            <Icon name="lucide:check" size="18" />
                        </DropdownMenuItemIndicator>
                        <Icon
                            name="lucide:tag"
                            size="18"
                            class="text-zinc-600 dark:text-zinc-400"
                        />
                        <span class="grow">カテゴリを変更</span>
                        <Icon name="lucide:chevron-right" size="18" />
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent
                            :class="windowClass"
                            :side-offset="2"
                            :align-offset="0"
                        >
                            <DropdownMenuItem
                                v-for="(value, key) in itemCategories()"
                                :key="'select-custom-category-' + key"
                                :class="buttonClass"
                                @select="emit('changeCategory', key)"
                            >
                                <Icon
                                    :name="value.icon"
                                    size="18"
                                    class="text-zinc-600 dark:text-zinc-400"
                                />
                                {{ value.label }}
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuCheckboxItem
                    v-model="unsupported"
                    :class="buttonClass"
                >
                    <Icon
                        name="lucide:user-round-x"
                        size="18"
                        class="text-zinc-600 dark:text-zinc-400"
                    />
                    <span class="grow">アバター非対応</span>
                    <DropdownMenuItemIndicator
                        class="inline-flex items-center justify-center"
                    >
                        <Icon name="lucide:check" size="18" />
                    </DropdownMenuItemIndicator>
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator
                    class="h-px bg-zinc-300 dark:bg-zinc-700 m-1"
                />

                <DropdownMenuItem :class="buttonClass" @select="emit('remove')">
                    <Icon name="lucide:x" size="18" class="text-red-400" />
                    <span class="text-red-400">削除</span>
                </DropdownMenuItem>
                <DropdownMenuArrow class="fill-zinc-500" />
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
