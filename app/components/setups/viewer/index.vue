<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

interface Props {
    setupId: number
    createdAt: string
    updatedAt: string
    name: string
    description?: string | null
    tags?: string[]
    coauthors?: SetupCoauthor[]
    user: User
    images?: SetupImage[]
    items: SetupItem[]
    failedItemsCount?: number
    hidAt?: string | null
    hidReason?: string | null
}
const props = defineProps<Props>()

const emit = defineEmits(['delete'])

const session = await useGetSession()
const toast = useToast()

const hideReason = ref('')
const modalHide = ref(false)

const hideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: '権限がありません',
            description: 'Admin アカウントでログインしてください。',
            color: 'error',
        })
        return
    }

    try {
        await $fetch(`/api/admin/setup/${props.setupId}`, {
            method: 'PATCH',
            body: {
                hide: true,
                hideReason: hideReason.value.length
                    ? hideReason.value
                    : undefined,
            },
        })
        toast.add({
            title: 'セットアップが非表示になりました',
            color: 'success',
        })
        hideReason.value = ''
        modalHide.value = false
    } catch (error) {
        console.error('セットアップの非表示に失敗:', error)
        toast.add({
            title: 'セットアップの非表示に失敗しました',
            color: 'error',
        })
    }
}

const shareX = useSocialShare({
    network: 'x',
    title: `${props.name} @${props.user.name} | Avatio`,
    image: props.images?.[0]?.url || undefined,
})
const shareBluesky = useSocialShare({
    network: 'bluesky',
    title: `${props.name} @${props.user.name} | Avatio`,
    image: props.images?.[0]?.url || undefined,
})
const shareLine = useSocialShare({
    network: 'line',
    title: `${props.name} @${props.user.name} | Avatio`,
    image: props.images?.[0]?.url || undefined,
})

const socialShareItems = ref<DropdownMenuItem[]>([
    [
        {
            label: 'リンクをコピー',
            icon: 'lucide:link',
            onSelect: () => {
                navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => {
                        toast.add({ title: 'リンクがコピーされました' })
                    })
                    .catch(() => {
                        toast.add({
                            title: 'リンクのコピーに失敗しました',
                            color: 'error',
                        })
                    })
            },
        },
    ],
    [
        {
            label: 'X',
            icon: 'simple-icons:x',
            onSelect: () => {
                navigateTo(shareX.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'Bluesky',
            icon: 'simple-icons:bluesky',
            onSelect: () => {
                navigateTo(shareBluesky.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'LINE',
            icon: 'simple-icons:line',
            onSelect: () => {
                navigateTo(shareLine.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
    ],
])

const bookmark = ref(false)
const bookmarkButtonStyle = computed<{
    icon: string
    label: string
    color: 'secondary' | 'primary'
}>(() => ({
    icon: bookmark.value ? 'lucide:bookmark-check' : 'lucide:bookmark',
    label: bookmark.value ? 'ブックマークから削除' : 'ブックマーク',
    color: bookmark.value ? 'secondary' : 'primary',
}))

const categoryAttributes = itemCategoryAttributes()

const categorizedItems = computed(() => {
    const itemsByCategory = props.items.reduce(
        (acc, item) => {
            const category = item.category || 'other'
            if (!acc[category]) acc[category] = []
            acc[category].push(item)
            return acc
        },
        {} as Record<string, SetupItem[]>
    )

    const orderedCategories: Record<string, SetupItem[]> = {}

    // itemCategoryAttributesで定義された順序でプロパティを追加
    for (const categoryKey of Object.keys(categoryAttributes))
        if (itemsByCategory[categoryKey])
            orderedCategories[categoryKey] = itemsByCategory[categoryKey]

    // itemCategoryAttributesに定義されていないカテゴリがあれば最後に追加
    for (const [categoryKey, items] of Object.entries(itemsByCategory))
        if (!orderedCategories[categoryKey])
            orderedCategories[categoryKey] = items

    return orderedCategories
})

const applyBookmark = useDebounceFn(async (isBookmarked: boolean) => {
    try {
        if (isBookmarked)
            await $fetch(`/api/setup/bookmark/${props.setupId}`, {
                method: 'POST',
            })
        else
            await $fetch(`/api/setup/bookmark/${props.setupId}`, {
                method: 'DELETE',
            })

        toast.add({
            title: isBookmarked
                ? 'ブックマークしました'
                : 'ブックマークを解除しました',
            color: isBookmarked ? 'success' : 'info',
        })
    } catch (error) {
        console.error('ブックマークの適用に失敗:', error)
        toast.add({
            title: 'ブックマークの適用に失敗しました',
            color: 'error',
        })
        return
    }
}, 500)

const toggleBookmark = () => {
    bookmark.value = !bookmark.value
    applyBookmark(bookmark.value)
}

onMounted(async () => {
    if (session.value) {
        try {
            const response = await $fetch<PaginationResponse<Bookmark[]>>(
                '/api/setup/bookmark',
                {
                    query: { setupId: props.setupId, limit: 1 },
                }
            )
            if (response.data?.length) bookmark.value = true
            else bookmark.value = false
        } catch (error) {
            console.error('ブックマークの取得に失敗:', error)
        }
    }
})
</script>

<template>
    <div class="relative flex w-full flex-col items-start gap-8 xl:flex-row">
        <div class="flex w-full flex-col items-start gap-4">
            <UAlert
                v-if="props.hidAt"
                icon="lucide:eye-off"
                title="このセットアップは現在非表示です"
                :description="`理由: ${props.hidReason || '不明'}`"
                variant="subtle"
                :actions="[
                    {
                        label: '異議申し立て',
                        variant: 'soft',
                        onClick: () => {
                            navigateTo('mailto:hello@liria.me', {
                                external: true,
                                open: { target: '_blank' },
                            })
                        },
                    },
                ]"
                class="w-full"
            />

            <div class="flex w-full flex-col items-start gap-1">
                <h1
                    class="text-highlighted text-3xl font-bold wrap-anywhere break-keep"
                    v-html="useLineBreak(props.name)"
                />
                <div class="flex w-full items-center justify-between gap-3">
                    <div class="ml-0.5 flex items-center gap-1.5">
                        <Icon
                            name="lucide:calendar"
                            size="16"
                            class="text-muted"
                        />
                        <NuxtTime
                            v-if="props.createdAt?.length"
                            :datetime="props.createdAt"
                            class="text-muted font-[Geist] text-sm leading-none text-nowrap"
                        />
                    </div>
                    <div class="flex items-center gap-0.5">
                        <UModal
                            v-if="session?.user.role === 'admin'"
                            v-model:open="modalHide"
                            title="セットアップを非表示"
                        >
                            <UButton
                                icon="lucide:eye-off"
                                variant="ghost"
                                size="sm"
                                class="p-2"
                            />

                            <template #body>
                                <div class="flex flex-col gap-2">
                                    <UAlert
                                        icon="lucide:eye-off"
                                        title="これは Admin アクションです"
                                        description="セットアップは非表示になり、再度表示するまでユーザーには見えなくなります。"
                                        color="warning"
                                        variant="subtle"
                                    />
                                    <UFormField label="理由" required>
                                        <UTextarea
                                            v-model="hideReason"
                                            autoresize
                                            class="w-full"
                                        />
                                    </UFormField>
                                </div>
                            </template>

                            <template #footer>
                                <UButton
                                    label="非表示にする"
                                    color="neutral"
                                    size="lg"
                                    block
                                    @click="hideSetup"
                                />
                            </template>
                        </UModal>

                        <UButton
                            v-if="session"
                            :icon="bookmarkButtonStyle.icon"
                            :aria-label="bookmarkButtonStyle.label"
                            :color="bookmarkButtonStyle.color"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                            @click="toggleBookmark"
                        />
                        <ModalLogin v-else>
                            <UButton
                                :icon="bookmarkButtonStyle.icon"
                                :aria-label="bookmarkButtonStyle.label"
                                :color="bookmarkButtonStyle.color"
                                variant="ghost"
                                size="sm"
                                class="p-2"
                            />
                        </ModalLogin>

                        <template v-if="session?.user.id === props.user.id">
                            <UModal title="セットアップを削除">
                                <UButton
                                    tooltip="削除"
                                    aria-label="削除"
                                    icon="lucide:trash"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                />

                                <template #body>
                                    <UAlert
                                        icon="lucide:trash"
                                        title="本当に削除しますか？"
                                        description="この操作は取り消すことができません。"
                                        color="warning"
                                        variant="subtle"
                                    />
                                </template>

                                <template #footer>
                                    <UButton
                                        label="削除"
                                        color="error"
                                        size="lg"
                                        block
                                        @click="emit('delete')"
                                    />
                                </template>
                            </UModal>
                        </template>

                        <template v-else>
                            <ModalReportSetup
                                v-if="session"
                                :setup-id="props.setupId!"
                            >
                                <UButton
                                    icon="lucide:flag"
                                    aria-label="報告"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                />
                            </ModalReportSetup>
                            <ModalLogin v-else>
                                <UButton
                                    icon="lucide:flag"
                                    aria-label="報告"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                />
                            </ModalLogin>
                        </template>

                        <UDropdownMenu
                            :items="socialShareItems"
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
                                icon="lucide:share-2"
                                aria-label="シェア"
                                variant="ghost"
                                size="sm"
                                class="p-2"
                            />
                        </UDropdownMenu>
                    </div>
                </div>
            </div>

            <UModal
                v-if="props.images?.length"
                :ui="{ content: 'bg-transparent ring-0 max-h-dvh max-w-dvh' }"
            >
                <NuxtImg
                    :src="props.images[0]?.url"
                    :alt="props.name"
                    :width="props.images[0]?.width ?? 640"
                    :height="props.images[0]?.height ?? 320"
                    class="h-full max-h-[720px] w-fit shrink-0 grow-0 cursor-zoom-in overflow-hidden rounded-lg object-contain"
                />

                <template #content>
                    <NuxtImg
                        :src="props.images[0]?.url"
                        :alt="props.name"
                        class="size-full object-contain"
                    />
                </template>
            </UModal>

            <SetupsViewerInfo
                :setup-id="props.setupId"
                :created-at="props.createdAt"
                :title="props.name"
                :description="props.description"
                :tags="props.tags"
                :co-authors="props.coauthors"
                :user="props.user"
                class="mt-3 w-full xl:hidden"
            />

            <div class="mt-3 flex w-full flex-col gap-7">
                <div
                    v-for="(value, key) in categorizedItems"
                    :key="'category-' + key"
                    class="flex flex-col gap-4 empty:hidden"
                >
                    <template v-if="value?.length">
                        <div class="flex items-center gap-2">
                            <Icon
                                :name="
                                    categoryAttributes[
                                        key as keyof typeof categoryAttributes
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
                                        key as keyof typeof categoryAttributes
                                    ]?.label || key
                                }}
                            </h2>
                        </div>
                        <SetupsViewerItem
                            v-for="(item, index) in value"
                            :key="`item-${key}-${index}`"
                            :item="item"
                        />
                    </template>
                </div>

                <template v-if="props.failedItemsCount">
                    <USeparator />

                    <UAlert
                        icon="lucide:circle-question-mark"
                        :title="`${props.failedItemsCount}個のアイテムが取得できませんでした`"
                        description="削除されたか、非公開になっている可能性があります。"
                        variant="subtle"
                        orientation="horizontal"
                        :actions="[
                            {
                                label: '不具合を報告',
                                variant: 'soft',
                                onClick: () => {
                                    navigateTo(
                                        'https://github.com/liria24/avatio/issues/new/choose',
                                        {
                                            external: true,
                                            open: { target: '_blank' },
                                        }
                                    )
                                },
                            },
                        ]"
                    />
                </template>
            </div>
        </div>

        <div class="hidden h-full w-full flex-col xl:flex xl:w-[440px]">
            <SetupsViewerInfo
                :setup-id="props.setupId"
                :created-at="props.createdAt"
                :title="props.name"
                :description="props.description"
                :tags="props.tags"
                :coauthors="props.coauthors"
                :user="props.user"
                class="sticky top-3 pt-3"
            />
        </div>
    </div>
</template>
