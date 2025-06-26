<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

const router = useRouter()
const toast = useToast()
const categoryAttributes = itemCategoryAttributes()

const publishing = ref(false)
const popoverItemSearch = ref(false)

interface State {
    name: string
    description: string
    images: SetupImage[]
    tags: string[]
    coauthors: SetupCoauthor[]
    items: Record<string, SetupItem[]>
}
const state = reactive<State>({
    name: '',
    description: '',
    images: [],
    tags: [],
    coauthors: [],
    items: {
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    },
})

const totalItemsCount = computed(() => {
    return Object.values(state.items).reduce((total, category) => {
        return total + category.length
    }, 0)
})

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
    if (!files?.length || !files[0]) return

    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', 'setup')

    const response = await $fetch('/api/image', {
        method: 'POST',
        body: formData,
    })

    if (response) {
        state.images.push({
            url: response.url,
            width: response.width || 0,
            height: response.height || 0,
        })
    }

    reset()
})

const removeImage = (index: number) => {
    if (index !== -1) state.images.splice(index, 1)
}

const addTag = (tag: string) => {
    if (!state.tags.includes(tag)) state.tags.push(tag)
    else
        toast.add({
            title: 'タグを重複して追加することはできません',
            color: 'warning',
        })
}

const removeTag = (tag: string) => {
    const index = state.tags.indexOf(tag)
    if (index !== -1) state.tags.splice(index, 1)
}

const addCoauthor = (user: User) => {
    if (!state.coauthors.find((coauthor) => coauthor.user.id === user.id))
        state.coauthors.push({
            user,
            note: '',
        })
    else
        toast.add({
            title: '共同作者を重複して追加することはできません',
            color: 'warning',
        })
}

const removeCoauthor = (id: string) => {
    const index = state.coauthors.findIndex(
        (coauthor) => coauthor.user.id === id
    )
    if (index !== -1) state.coauthors.splice(index, 1)
}

const addItem = async (item: Item) => {
    for (const category in state.items)
        if (state.items[category]?.some((i) => i.id === item.id)) {
            toast.add({
                title: 'アイテムはすでに追加されています',
                color: 'warning',
            })
            return
        }

    state.items[item.category]?.push({
        ...item,
        note: '',
        unsupported: false,
    })
    popoverItemSearch.value = false
}

const removeItem = (category: string, id: string) => {
    const index = state.items[category]?.findIndex((item) => item.id === id)
    console.log(index)
    if (index !== undefined && index !== -1)
        state.items[category]?.splice(index, 1)
}

const changeItemCategory = (id: string, category: ItemCategory) => {
    for (const cat in state.items) {
        const index = state.items[cat]?.findIndex((item) => item.id === id)
        if (index !== undefined && index !== -1) {
            const [item] = state.items[cat]?.splice(index, 1) || []
            if (item) {
                item.category = category
                state.items[category]?.push(item)
            }
            return
        }
    }
}

const onSubmit = async () => {
    console.log('Submitting setup:', state)
}
</script>

<template>
    <UForm
        :state
        class="relative size-full pb-5 lg:pl-[23rem]"
        @submit="onSubmit"
    >
        <div
            :class="
                cn(
                    'ring-accented relative top-0 bottom-4 left-0 flex flex-col overflow-y-auto rounded-lg',
                    'lg:absolute lg:w-[22rem] lg:ring-2'
                )
            "
        >
            <div
                class="sticky top-0 right-0 left-0 z-[1] hidden items-center gap-1 p-5 lg:flex"
            >
                <UButton
                    type="submit"
                    :label="!publishing ? '公開' : '処理中'"
                    icon="lucide:upload"
                    color="neutral"
                    size="sm"
                    block
                    :loading="publishing"
                    class="rounded-full p-3"
                />

                <UButton
                    icon="lucide:trash"
                    variant="ghost"
                    size="sm"
                    class="rounded-full p-3"
                    @click="router.back()"
                />
            </div>

            <div class="flex flex-col gap-8 p-5 pt-2">
                <div
                    class="grid grid-flow-row gap-6 sm:grid-cols-2 lg:grid-flow-row lg:grid-cols-1"
                >
                    <div class="flex flex-col gap-4">
                        <UButton
                            v-if="!state.images.length"
                            icon="lucide:image-plus"
                            label="画像を追加"
                            variant="soft"
                            block
                            class="h-24 p-3"
                            @click="open()"
                        />
                        <div v-else class="grid grid-cols-3 gap-2">
                            <div
                                v-for="(image, index) in state.images"
                                :key="'image-' + index"
                                class="relative grid"
                            >
                                <NuxtImg
                                    :src="image.url"
                                    class="aspect-square rounded-lg object-cover"
                                />
                                <UButton
                                    icon="lucide:x"
                                    color="neutral"
                                    class="absolute top-1 right-1 z-10 rounded-full"
                                    @click="removeImage(index)"
                                />
                            </div>
                        </div>

                        <UFormField name="name" label="タイトル" required>
                            <UInput
                                v-model="state.name"
                                placeholder="セットアップ名"
                                variant="subtle"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField name="description" label="説明">
                            <UTextarea
                                v-model="state.description"
                                placeholder="説明"
                                autoresize
                                variant="soft"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField name="tags" label="タグ">
                            <div class="flex flex-wrap items-center gap-2">
                                <UBadge
                                    v-for="(tag, index) in state.tags"
                                    :key="index"
                                    :label="tag"
                                    variant="soft"
                                    class="py-1 pr-1 pl-3"
                                >
                                    <template #trailing>
                                        <UButton
                                            icon="lucide:x"
                                            variant="ghost"
                                            size="xs"
                                            @click="removeTag(tag)"
                                        />
                                    </template>
                                </UBadge>

                                <UPopover
                                    :content="{ side: 'right', align: 'start' }"
                                >
                                    <UButton
                                        icon="lucide:plus"
                                        :label="
                                            state.tags.length
                                                ? undefined
                                                : 'タグを追加'
                                        "
                                        variant="soft"
                                    />

                                    <template #content>
                                        <CommandPaletteTagSearch
                                            @select="addTag"
                                        />
                                    </template>
                                </UPopover>
                            </div>
                        </UFormField>

                        <UFormField name="coauthors" label="共同作者">
                            <div class="flex flex-col gap-2">
                                <VueDraggable
                                    v-model="state.coauthors"
                                    :animation="150"
                                    handle=".draggable"
                                    drag-class="opacity-100"
                                    ghost-class="opacity-0"
                                    class="flex h-full w-full flex-col gap-2 empty:hidden"
                                >
                                    <div
                                        v-for="(
                                            coauthor, index
                                        ) in state.coauthors"
                                        :key="'coauthor-' + index"
                                        class="ring-accented flex items-stretch gap-2 rounded-md p-2 ring-1"
                                    >
                                        <div
                                            class="draggable hover:bg-elevated grid cursor-move rounded-md px-1 py-2 transition-colors"
                                        >
                                            <Icon
                                                name="lucide:grip-vertical"
                                                size="18"
                                                class="text-muted shrink-0 self-center"
                                            />
                                        </div>

                                        <div class="flex grow flex-col gap-2">
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <UAvatar
                                                    :src="
                                                        coauthor.user.image ||
                                                        undefined
                                                    "
                                                    :alt="coauthor.user.name"
                                                    size="xs"
                                                />
                                                <span
                                                    class="text-toned grow text-xs"
                                                >
                                                    {{ coauthor.user.name }}
                                                </span>
                                                <UButton
                                                    icon="lucide:x"
                                                    variant="ghost"
                                                    size="xs"
                                                    @click="
                                                        removeCoauthor(
                                                            coauthor.user.id
                                                        )
                                                    "
                                                />
                                            </div>
                                            <UInput
                                                v-model="coauthor.note"
                                                placeholder="ノート"
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                </VueDraggable>

                                <UPopover
                                    :content="{ side: 'right', align: 'start' }"
                                >
                                    <UButton
                                        icon="lucide:plus"
                                        :label="
                                            state.coauthors.length
                                                ? undefined
                                                : '共同作者を追加'
                                        "
                                        variant="soft"
                                    />

                                    <template #content>
                                        <CommandPaletteUserSearch
                                            @select="addCoauthor"
                                        />
                                    </template>
                                </UPopover>
                            </div>
                        </UFormField>
                    </div>
                </div>
            </div>
        </div>

        <USeparator class="my-8 lg:hidden" />

        <div class="relative flex h-full flex-col items-center gap-8">
            <div class="flex w-full flex-col items-stretch gap-4">
                <div class="flex items-center gap-2">
                    <div class="flex grow items-center gap-1">
                        <UButton icon="lucide:undo-2" variant="ghost" />
                        <UButton icon="lucide:redo-2" variant="ghost" />

                        <div
                            :data-exceeded="totalItemsCount > 32"
                            class="ring-accented ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 data-[exceeded=true]:ring-red-500"
                        >
                            <Icon
                                name="lucide:box"
                                size="16"
                                class="text-muted shrink-0"
                            />
                            <span
                                class="pt-px font-[Geist] text-xs leading-none text-nowrap"
                            >
                                <span>{{ totalItemsCount }}</span>
                                <span v-if="totalItemsCount > 32">/ 32</span>
                            </span>
                        </div>
                    </div>

                    <UPopover
                        v-model:open="popoverItemSearch"
                        :content="{ side: 'bottom', align: 'end' }"
                        :ui="{ content: 'max-w-96' }"
                    >
                        <UButton
                            icon="lucide:plus"
                            label="アイテムを追加"
                            variant="soft"
                            color="neutral"
                        />

                        <template #content>
                            <CommandPaletteItemSearch @select="addItem" />
                        </template>
                    </UPopover>
                </div>
            </div>

            <div
                v-if="!totalItemsCount"
                class="flex h-full flex-col items-center justify-center gap-6"
            >
                <p class="text-muted text-sm">アイテムが登録されていません</p>
                <!-- <SetupsEditItemsOwnedAvatar @add="addItem" /> -->
            </div>

            <div
                v-else
                class="absolute inset-0 mt-16 flex flex-col gap-6 overflow-y-auto p-1"
            >
                <div
                    v-for="category in Object.keys(state.items)"
                    :key="'item-category-' + category"
                    class="flex flex-col gap-4 empty:hidden"
                >
                    <template v-if="state.items[category]?.length">
                        <div class="flex items-center gap-2">
                            <Icon
                                :name="
                                    categoryAttributes[
                                        category as keyof typeof categoryAttributes
                                    ]?.icon || 'lucide:box'
                                "
                                :size="22"
                                class="text-muted shrink-0"
                            />
                            <h2
                                class="pb-0.5 text-lg leading-none font-semibold text-nowrap"
                            >
                                {{
                                    categoryAttributes[
                                        category as keyof typeof categoryAttributes
                                    ]?.label || category
                                }}
                            </h2>
                        </div>

                        <VueDraggable
                            v-model="state.items[category]"
                            :animation="150"
                            handle=".draggable"
                            drag-class="opacity-100"
                            ghost-class="opacity-0"
                            class="flex h-full w-full flex-col gap-2 empty:hidden"
                        >
                            <div
                                v-for="(item, index) in state.items[category]"
                                :key="'item-' + index"
                                class="ring-accented flex items-start gap-2 rounded-md p-2 ring-1"
                            >
                                <div
                                    class="draggable hover:bg-elevated grid h-full cursor-move rounded-md px-1 py-2 transition-colors"
                                >
                                    <Icon
                                        name="lucide:grip-vertical"
                                        size="18"
                                        class="text-muted shrink-0 self-center"
                                    />
                                </div>

                                <div class="flex grow flex-col gap-2">
                                    <div class="flex items-start gap-1">
                                        <NuxtImg
                                            :src="item.image || undefined"
                                            class="size-18 rounded-lg"
                                        />

                                        <div
                                            class="flex grow flex-col gap-2 self-center pl-2"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <UTooltip
                                                    v-if="
                                                        item.platform ===
                                                        'booth'
                                                    "
                                                    text="BOOTH"
                                                    :delay-duration="50"
                                                >
                                                    <Icon
                                                        name="avatio:booth"
                                                        size="16"
                                                        class="text-muted shrink-0"
                                                    />
                                                </UTooltip>
                                                <p class="text-toned text-sm">
                                                    {{ item.name }}
                                                </p>
                                            </div>
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <UButton
                                                    label="シェイプキー"
                                                    variant="subtle"
                                                    size="sm"
                                                />
                                                <UCheckbox
                                                    v-model="item.unsupported"
                                                    label="ベースアバターに非対応"
                                                    size="sm"
                                                />
                                            </div>
                                        </div>

                                        <UDropdownMenu
                                            :items="
                                                Object.entries(
                                                    categoryAttributes
                                                ).map(([key, value]) => ({
                                                    label: value.label,
                                                    icon: value.icon,
                                                    value: key,
                                                    onSelect: () =>
                                                        changeItemCategory(
                                                            item.id,
                                                            key as ItemCategory
                                                        ),
                                                }))
                                            "
                                            :content="{
                                                align: 'center',
                                                side: 'bottom',
                                                sideOffset: 8,
                                            }"
                                            :ui="{
                                                content: 'w-40',
                                            }"
                                        >
                                            <UButton
                                                :icon="
                                                    categoryAttributes[
                                                        item.category
                                                    ]?.icon || 'lucide:box'
                                                "
                                                variant="ghost"
                                                size="sm"
                                            />
                                        </UDropdownMenu>

                                        <UButton
                                            icon="lucide:x"
                                            variant="ghost"
                                            size="sm"
                                            @click="
                                                removeItem(
                                                    item.category,
                                                    item.id
                                                )
                                            "
                                        />
                                    </div>

                                    <UTextarea
                                        v-model="item.note"
                                        placeholder="ノートの追加"
                                        autoresize
                                        size="sm"
                                        :rows="1"
                                        variant="soft"
                                        class="w-full"
                                    />
                                </div>
                            </div>
                        </VueDraggable>
                    </template>
                </div>
            </div>
        </div>

        <UButton
            icon="lucide:upload"
            aria-label="セットアップを投稿"
            :loading="publishing"
            class="fixed right-3 bottom-3 rounded-full p-4 whitespace-nowrap hover:bg-zinc-700 hover:text-zinc-200 lg:hidden dark:bg-zinc-300 dark:text-zinc-900 hover:dark:text-zinc-100"
        />
    </UForm>
</template>
