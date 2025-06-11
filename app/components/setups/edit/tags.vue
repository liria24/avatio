<script lang="ts" setup>
const client = useSupabaseClient()

const tags = defineModel<string[]>({
    default: [],
})
const suggestion = ref<string[]>([])
const loading = ref(false)

const add = (tag: string) => {
    if (!tags.value.includes(tag)) {
        tags.value.push(tag)
    }
    const input = document.getElementById('tagInput') as HTMLInputElement
    if (input) {
        input.value = ''
    }
    input.focus()
}

const handle = () => {
    const input = document.getElementById('tagInput') as HTMLInputElement

    suggestion.value = []
    if (input?.value.length) {
        loading.value = true
    } else {
        loading.value = false
    }
    suggest()
}

const suggest = useDebounceFn(
    async () => {
        const input = document.getElementById('tagInput') as HTMLInputElement

        if (input?.value.length) {
            const { data, error } = await client.rpc('search_tags', {
                keywords: input.value,
                exclude: tags.value,
            })

            if (error) {
                suggestion.value = []
                loading.value = false
                return
            }

            suggestion.value = data.map((i: { tag: string }) => i.tag)

            loading.value = false
        } else {
            suggestion.value = []
            loading.value = false
        }
    },
    700,
    { maxWait: 1600 }
) // 700～1600ms デバウンス

watch(tags, () => {
    suggestion.value = []
})
</script>

<template>
    <div class="flex w-full flex-col gap-1">
        <TagsInputRoot
            v-model="tags"
            :class="[
                'flex w-full flex-wrap items-center gap-2 rounded-lg p-2',
                'ring-1 ring-zinc-400 ring-inset focus-within:ring-2 focus-within:ring-zinc-700 hover:ring-2 dark:ring-zinc-700',
            ]"
        >
            <TagsInputItem
                v-for="item in tags"
                :key="item"
                :value="item"
                class="flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 px-1 py-1 text-black dark:border-zinc-600 dark:text-white"
            >
                <TagsInputItemText class="pl-2 text-sm" />
                <TagsInputItemDelete
                    :class="[
                        'flex cursor-pointer items-center justify-center rounded-full p-1',
                        'hover:bg-zinc-300 hover:dark:bg-zinc-700',
                        'transition duration-100 ease-in-out',
                    ]"
                >
                    <Icon name="lucide:x" />
                </TagsInputItemDelete>
            </TagsInputItem>

            <TagsInputInput
                id="tagInput"
                placeholder="タグを入力"
                class="flex-1 bg-transparent px-1 text-sm placeholder:text-zinc-400 focus:outline-hidden dark:placeholder:text-zinc-500"
                @input="handle"
            />
        </TagsInputRoot>
        <div
            v-if="suggestion.length || loading"
            class="flex w-full flex-wrap gap-1 rounded-lg border border-zinc-400 p-2 dark:border-zinc-600"
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
                class="cursor-pointer gap-1.5 rounded-full border border-zinc-400 px-3 py-1 text-sm transition duration-100 ease-in-out hover:bg-zinc-300 dark:border-zinc-600 hover:dark:bg-zinc-600"
                @click="add(i)"
            >
                {{ i }}
            </button>
        </div>
    </div>
</template>
