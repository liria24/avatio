<script lang="ts" setup>
const searchItems = defineModel<
    {
        id: number
        name: string
        thumbnail: string
        shop: string
        category: string
    }[]
>('items', {
    default: [],
})
const searching = defineModel<boolean>('searching', {
    default: false,
})
const emit = defineEmits(['add'])
</script>

<template>
    <div
        :class="[
            'flex min-h-[30vh] rounded-2xl p-4',
            'ring-1 ring-zinc-300 dark:ring-zinc-700',
            'bg-zinc-100 dark:bg-zinc-900',
            'shadow-xl shadow-black/10 dark:shadow-black/50',
        ]"
    >
        <div
            v-if="searching"
            class="flex size-full items-center justify-center self-center"
        >
            <Icon name="i-svg-spinners-ring-resize" size="20" />
        </div>

        <div
            v-else
            class="flex max-h-[60vh] w-full flex-col gap-6 overflow-y-auto"
        >
            <div
                v-for="(c, index) in Object.values(itemCategories())"
                :key="'category-' + index"
                class="flex w-full flex-col gap-3 empty:hidden"
            >
                <template
                    v-if="
                        searchItems.filter((item) =>
                            c.id
                                ? item.category === c.id
                                : !Object.values(itemCategories())
                                      .map((value) => value.id)
                                      .includes(item.category)
                        ).length
                    "
                >
                    <UiTitle :label="c.label" :icon="c.icon" />
                    <div class="flex flex-col gap-2 px-3">
                        <Button
                            v-for="i in searchItems.filter((item) =>
                                c.id
                                    ? item.category === c.id
                                    : !Object.values(itemCategories())
                                          .map((value) => value.id)
                                          .includes(item.category)
                            )"
                            :key="useId()"
                            variant="flat"
                            class="w-full p-1 pr-2"
                            @click="emit('add', i.id)"
                        >
                            <NuxtImg
                                :src="i.thumbnail"
                                :alt="i.name"
                                :width="40"
                                :height="40"
                                format="webp"
                                fit="cover"
                                class="size-10 rounded-lg object-cover"
                            />
                            <p
                                class="line-clamp-1 grow text-left text-sm break-all text-zinc-800 dark:text-zinc-200"
                            >
                                {{ i.name }}
                            </p>
                            <p
                                class="line-clamp-1 max-w-32 min-w-20 text-right text-xs break-all text-zinc-600 dark:text-zinc-400"
                            >
                                {{ i.shop }}
                            </p>
                        </Button>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
