<script lang="ts" setup>
const model = defineModel<CoAuthor[]>({
    default: [],
})

const toast = useToast()

const input = ref('')
const searching = ref(false)
const searchedUsers = ref<CoAuthor[]>([])

const user = useSupabaseUser()
const client = useSupabaseClient()

const add = async (id: string) => {
    if (id.length) {
        if (id === user.value?.id)
            return toast.add({
                title: '自身を共同作者として追加することはできません',
            })

        const { data } = await client
            .from('users')
            .select('id, name, avatar')
            .eq('id', id)
            .maybeSingle()
        if (!data)
            return toast.add({
                title: 'ユーザーが見つかりませんでした',
                color: 'warning',
            })

        model.value.push({
            id: id,
            name: data.name,
            avatar: data.avatar || null,
            badges: [],
            note: '',
        })
        input.value = ''
    }
}

const remove = (index: number) => {
    model.value.splice(index, 1)
}

const handleInputChange = useDebounceFn(
    async (value: string) => {
        if (value.length) {
            searching.value = true

            const { data } = await client.rpc('search_users', {
                keyword: value,
                num: 20,
            })

            searchedUsers.value = data ?? []
            searching.value = false
        } else {
            searchedUsers.value = []
        }
    },
    400,
    { maxWait: 1000 }
) // 400～1000ms デバウンス

// watch のコールバックを直接 debounced 関数に渡す
watch(input, handleInputChange)
</script>

<template>
    <div class="flex w-full flex-col gap-2">
        <Popup v-if="model.length < 5" side="top">
            <template #trigger>
                <Button variant="flat">
                    <Icon name="lucide:plus" size="18" />
                    <span>ユーザーを追加</span>
                </Button>
            </template>

            <template #content>
                <div class="flex min-w-48 flex-col gap-2 text-sm">
                    <UiTextinput
                        v-model="input"
                        placeholder="ユーザー名"
                        @keyup.enter="add(input.trim())"
                    />

                    <Icon
                        v-if="searching"
                        name="svg-spinners:ring-resize"
                        size="18"
                    />

                    <div v-else class="flex flex-col gap-1 empty:hidden">
                        <Button
                            v-for="i in searchedUsers"
                            :key="`coauthor-${i.id}`"
                            variant="flat"
                            class="justify-start p-2"
                            @click="add(i.id)"
                        >
                            <UiAvatar
                                :url="getImage(i.avatar, { prefix: 'avatar' })"
                                :alt="i.name"
                                class="size-9"
                            />
                            <span>{{ i.name }}</span>
                        </Button>
                    </div>
                </div>
            </template>
        </Popup>
        <SetupsEditCoAuthorItem
            v-for="(i, index) in model"
            :key="`coauthor-${index}`"
            :id="i.id"
            :name="i.name"
            :avatar="i.avatar"
            v-model:note="i.note"
            @remove="remove(index)"
        />
    </div>
</template>
