<script lang="ts" setup>
const searchWord = defineModel<string>({
    default: '',
})
</script>

<template>
    <div
        :class="[
            'flex flex-col gap-3 rounded-2xl px-5 py-4',
            'ring-1 ring-zinc-300 dark:ring-zinc-700',
            'bg-zinc-100 dark:bg-zinc-900',
            'shadow-xl shadow-black/10 dark:shadow-black/50',
        ]"
    >
        <div
            v-if="!searchWord.length"
            class="flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400"
        >
            <label for="search" class="text-sm"> Avatioから検索 </label>

            <Popup>
                <template #trigger>
                    <Icon name="lucide:info" size="16" class="cursor-pointer" />
                </template>

                <template #content>
                    <div class="flex flex-col gap-4">
                        <h2 class="text-sm font-semibold">
                            Avatioからの検索について
                        </h2>
                        <p class="text-xs text-zinc-700 dark:text-zinc-300">
                            Avatio上に登録されているアイテムのみを検索します。<br />
                            外部サイトに登録されているアイテムすべてを検索することはできません。
                        </p>
                    </div>
                </template>
            </Popup>
        </div>
        <UiTextinput
            id="search"
            v-model="searchWord"
            unstyled
            icon="lucide:search"
            placeholder="アイテム名検索"
            class="text-sm"
        />
    </div>
</template>
