<script lang="ts" setup>
const client = useSupabaseClient();

const tags = defineModel<string[]>({
    default: [],
});
const suggestion = ref<string[]>([]);
const loading = ref(false);

const add = (tag: string) => {
    if (!tags.value.includes(tag)) {
        tags.value.push(tag);
    }
    const input = document.getElementById('tagInput') as HTMLInputElement;
    if (input) {
        input.value = '';
    }
    input.focus();
};

const handle = () => {
    const input = document.getElementById('tagInput') as HTMLInputElement;

    suggestion.value = [];
    if (input?.value.length) {
        loading.value = true;
    } else {
        loading.value = false;
    }
    suggest();
};

const suggest = useDebounceFn(
    async () => {
        const input = document.getElementById('tagInput') as HTMLInputElement;

        if (input?.value.length) {
            const { data, error } = await client.rpc('search_tags', {
                keywords: input.value,
                exclude: tags.value,
            });

            if (error) {
                suggestion.value = [];
                loading.value = false;
                return;
            }

            suggestion.value = data.map((i: { tag: string }) => i.tag);

            loading.value = false;
        } else {
            suggestion.value = [];
            loading.value = false;
        }
    },
    700,
    { maxWait: 1600 }
); // 700～1600ms デバウンス

watch(tags, () => {
    suggestion.value = [];
});
</script>

<template>
    <div class="w-full flex flex-col gap-1">
        <TagsInputRoot
            v-model="tags"
            :class="[
                'flex gap-2 items-center p-2 rounded-lg w-full flex-wrap',
                'ring-inset ring-1 hover:ring-2 focus-within:ring-2 ring-zinc-400 dark:ring-zinc-700 focus-within:ring-zinc-700',
            ]"
        >
            <TagsInputItem
                v-for="item in tags"
                :key="item"
                :value="item"
                class="dark:text-white text-black flex items-center justify-center gap-1.5 rounded-full px-1 py-1 border border-zinc-300 dark:border-zinc-600"
            >
                <TagsInputItemText class="text-sm pl-2" />
                <TagsInputItemDelete
                    :class="[
                        'cursor-pointer p-1 rounded-full flex items-center justify-center',
                        'hover:bg-zinc-300 hover:dark:bg-zinc-700',
                        'transition ease-in-out duration-100',
                    ]"
                >
                    <Icon name="lucide:x" />
                </TagsInputItemDelete>
            </TagsInputItem>

            <TagsInputInput
                id="tagInput"
                placeholder="タグを入力"
                class="text-sm focus:outline-hidden flex-1 bg-transparent px-1 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                @input="handle"
            />
        </TagsInputRoot>
        <div
            v-if="suggestion.length || loading"
            class="w-full flex flex-wrap gap-1 rounded-lg p-2 border border-zinc-400 dark:border-zinc-600"
        >
            <Icon
                v-show="loading"
                name="svg-spinners:ring-resize"
                class="m-1.5 shrink-0"
            />
            <button
                v-for="i in suggestion"
                :key="useId()"
                type="button"
                class="cursor-pointer gap-1.5 rounded-full px-3 py-1 text-sm border border-zinc-400 dark:border-zinc-600 hover:bg-zinc-300 hover:dark:bg-zinc-600 transition ease-in-out duration-100"
                @click="add(i)"
            >
                {{ i }}
            </button>
        </div>
    </div>
</template>
