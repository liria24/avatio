<script setup lang="ts">
import {
    LazyModalLogin,
    LazyModalReportSetup,
    LazyModalSetupDelete,
    LazyModalSetupHide,
    LazyModalSetupUnhide,
    LazyModalImage,
} from '#components'

const { $session } = useNuxtApp()
const session = await $session()
const nuxtApp = useNuxtApp()
const route = useRoute()
const toast = useToast()
const overlay = useOverlay()

const id = Number(route.params.id)
const cache =
    route.query.cache === undefined
        ? true
        : route.query.cache === 'true' || route.query.cache === '1'

const modalImage = overlay.create(LazyModalImage)
const modalLogin = overlay.create(LazyModalLogin)
const modalReport = overlay.create(LazyModalReportSetup)
const modalDelete = overlay.create(LazyModalSetupDelete)
const modalHide = overlay.create(LazyModalSetupHide)
const modalUnhide = overlay.create(LazyModalSetupUnhide)

const { data, status } = await useSetup(id, {
    getCachedData: cache
        ? (key: string) => nuxtApp.payload.data[key] || nuxtApp.static.data[key]
        : undefined,
})

if (status.value === 'success' && !id)
    throw showError({
        statusCode: 400,
        message: 'IDが無効です',
    })

if (status.value === 'error' || (status.value === 'success' && !data.value))
    throw showError({
        statusCode: 404,
        message: 'セットアップが見つかりません',
    })

const {
    data: bookmark,
    status: bookmarkStatus,
    refresh: bookmarkRefresh,
} = await useFetch('/api/setups/bookmarks', {
    query: { setupId: data.value?.id, limit: 1 },
    transform: (data) => data.data.length > 0,
    dedupe: 'defer',
    default: () => false,
    headers:
        import.meta.server && nuxtApp.ssrContext?.event.headers
            ? nuxtApp.ssrContext.event.headers
            : undefined,
})

const toggleBookmark = async () => {
    try {
        if (!bookmark.value)
            await $fetch(`/api/setups/bookmarks/${data.value?.id}`, {
                method: 'POST',
            })
        else
            await $fetch(`/api/setups/bookmarks/${data.value?.id}`, {
                method: 'DELETE',
            })

        await bookmarkRefresh()

        toast.add({
            title: bookmark.value
                ? 'ブックマークしました'
                : 'ブックマークを解除しました',
            color: bookmark.value ? 'success' : 'info',
        })
    } catch (error) {
        console.error('ブックマークの変更に失敗:', error)
        toast.add({
            title: 'ブックマークの変更に失敗しました',
            color: 'error',
        })
        return
    }
}

const categoryAttributes = itemCategoryAttributes()

const categorizedItems = computed(() => {
    const itemsByCategory = data.value?.items.reduce(
        (acc, item) => {
            const category = item.category || 'other'
            if (!acc[category]) acc[category] = []
            acc[category].push(item)
            return acc
        },
        {} as Record<string, SetupItem[]>
    )

    const orderedCategories: Record<string, SetupItem[]> = {}

    if (!itemsByCategory) return

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

if (data.value) {
    defineSeo({
        title: `${data.value.name} @${data.value.user.name}`,
        description: data.value.description || undefined,
        image:
            data.value.images?.length && data.value.images[0]
                ? data.value.images[0].url
                : 'https://avatio.me/ogp.png',
    })
    useSchemaOrg([
        defineWebPage({
            name: data.value.name,
            description: data.value.description,
            datePublished: data.value.createdAt,
            author: {
                '@type': 'Person',
                name: data.value.user.name,
                url: `/@${data.value.user.id}`,
            },
            primaryImageOfPage: data.value.images?.[0]?.url,
            breadcrumb: defineBreadcrumb({
                itemListElement: [
                    { name: 'ホーム', item: '/' },
                    { name: 'セットアップ', item: '/setup' },
                    { name: data.value.name, item: `/setup/${id}` },
                ],
            }),
            inLanguage: 'ja-JP',
        }),
    ])
}
</script>

<template>
    <UPage
        v-if="data"
        :ui="{ center: 'lg:col-span-7', right: 'lg:col-span-3' }"
    >
        <UBreadcrumb
            :items="[
                { label: data.user.name, to: `/@${data.user.id}` },
                { label: data.name },
            ]"
            :ui="{ link: 'text-xs', separatorIcon: 'size-4' }"
        />

        <UPageBody>
            <div class="flex w-full flex-col items-start gap-4">
                <UAlert
                    v-if="data.hidAt"
                    icon="lucide:eye-off"
                    title="このセットアップは現在非表示です"
                    :description="`理由: ${data.hidReason || '不明'}`"
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

                <div class="flex w-full flex-col items-start gap-3">
                    <h1
                        class="text-highlighted text-3xl font-bold wrap-anywhere break-keep"
                        v-html="useLineBreak(data.name)"
                    />

                    <div class="flex w-full items-center justify-between gap-3">
                        <div
                            class="flex flex-wrap items-center gap-x-4 gap-y-2"
                        >
                            <NuxtLink :to="`/@${data.user.id}`">
                                <UUser
                                    :name="data.user.name"
                                    :avatar="{
                                        src: data.user.image || undefined,
                                        icon: 'lucide:user-round',
                                    }"
                                    size="sm"
                                    :ui="{ name: 'text-sm' }"
                                >
                                    <template #description>
                                        <UserBadges
                                            v-if="data.user.badges?.length"
                                            :badges="data.user.badges"
                                            size="xs"
                                        />
                                    </template>
                                </UUser>
                            </NuxtLink>

                            <div class="ml-0.5 flex items-center gap-1.5">
                                <Icon
                                    name="lucide:calendar"
                                    size="16"
                                    class="text-muted"
                                />
                                <NuxtTime
                                    :datetime="data.createdAt"
                                    locale="ja-JP"
                                    year="numeric"
                                    month="2-digit"
                                    day="2-digit"
                                    hour="2-digit"
                                    minute="2-digit"
                                    class="text-muted font-[Geist] text-sm leading-none text-nowrap"
                                />
                                <UTooltip
                                    v-if="data.updatedAt !== data.createdAt"
                                    :delay-duration="50"
                                >
                                    <div
                                        class="text-dimmed flex items-center gap-1.5"
                                    >
                                        <Icon
                                            name="lucide:pen-line"
                                            size="16"
                                        />
                                        <span
                                            class="text-xs leading-none text-nowrap"
                                        >
                                            <NuxtTime
                                                :datetime="data.updatedAt"
                                                relative
                                            />
                                            に更新
                                        </span>
                                    </div>

                                    <template #content>
                                        <NuxtTime
                                            :datetime="data.updatedAt"
                                            locale="ja-JP"
                                            year="numeric"
                                            month="2-digit"
                                            day="2-digit"
                                            hour="2-digit"
                                            minute="2-digit"
                                            class="text-muted font-[Geist] text-xs leading-none text-nowrap"
                                        />
                                        <span
                                            class="text-muted text-xs leading-none text-nowrap"
                                        >
                                            に編集
                                        </span>
                                    </template>
                                </UTooltip>
                            </div>
                        </div>

                        <div class="flex items-center gap-0.5">
                            <UButton
                                v-if="session?.user.role === 'admin'"
                                :icon="
                                    data.hidAt ? 'lucide:eye' : 'lucide:eye-off'
                                "
                                variant="ghost"
                                size="sm"
                                class="p-2"
                                @click="
                                    data.hidAt
                                        ? modalUnhide.open({
                                              setupId: data.id,
                                          })
                                        : modalHide.open({
                                              setupId: data.id,
                                          })
                                "
                            />

                            <UButton
                                loading-auto
                                :loading="bookmarkStatus === 'pending'"
                                :icon="
                                    bookmark
                                        ? 'lucide:bookmark-check'
                                        : 'lucide:bookmark'
                                "
                                :aria-label="
                                    bookmark
                                        ? 'ブックマークから削除'
                                        : 'ブックマーク'
                                "
                                :color="bookmark ? 'secondary' : 'primary'"
                                variant="ghost"
                                size="sm"
                                class="p-2"
                                @click="
                                    session
                                        ? toggleBookmark()
                                        : modalLogin.open()
                                "
                            />

                            <template v-if="session?.user.id === data.user.id">
                                <UButton
                                    :to="`/setup/compose?edit=${data.id}`"
                                    aria-label="編集"
                                    icon="lucide:pen"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                />

                                <UButton
                                    aria-label="削除"
                                    icon="lucide:trash"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                    @click="
                                        modalDelete.open({
                                            setupId: data.id,
                                        })
                                    "
                                />
                            </template>

                            <UButton
                                v-else
                                icon="lucide:flag"
                                aria-label="報告"
                                variant="ghost"
                                size="sm"
                                class="p-2"
                                @click="
                                    session
                                        ? modalReport.open({
                                              setupId: data.id,
                                          })
                                        : modalLogin.open()
                                "
                            />

                            <ShareButton
                                :title="data.name"
                                :description="data.description"
                                :image="data.images?.[0]?.url"
                            />
                        </div>
                    </div>
                </div>

                <NuxtImg
                    v-if="data.images?.length && data.images[0]"
                    v-slot="{ src, imgAttrs, isLoaded }"
                    :src="data.images[0].url"
                    :alt="data.name"
                    :width="data.images[0].width"
                    :height="data.images[0].height"
                    format="webp"
                    custom
                    class="max-h-[720px] w-fit shrink-0 grow-0 cursor-zoom-in overflow-hidden rounded-lg object-contain"
                >
                    <img
                        v-if="isLoaded"
                        v-bind="imgAttrs"
                        :src="src"
                        @click="
                            modalImage.open({
                                src: data.images[0].url,
                                alt: data.name,
                            })
                        "
                    />
                    <USkeleton
                        v-else
                        :style="{
                            aspectRatio:
                                data.images[0].width / data.images[0].height,
                        }"
                        class="max-h-[720px] w-full shrink-0 grow-0 rounded-lg"
                    />
                </NuxtImg>

                <SetupsViewerInfo :setup="data" class="mt-3 w-full lg:hidden" />

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

                    <template v-if="data.failedItemsCount">
                        <USeparator />

                        <UAlert
                            icon="lucide:circle-question-mark"
                            :title="`${data.failedItemsCount}個のアイテムが取得できませんでした`"
                            description="削除されたか、非公開になっている可能性があります。"
                            variant="subtle"
                            orientation="horizontal"
                            :actions="[
                                {
                                    label: '不具合を報告',
                                    to: 'https://github.com/liria24/avatio/issues/new?template=%F0%9F%9A%A7-bug-report.md',
                                    target: '_blank',
                                    variant: 'soft',
                                },
                            ]"
                        />
                    </template>
                </div>
            </div>
        </UPageBody>

        <template #right>
            <UPageAside>
                <SetupsViewerInfo :setup="data" class="sticky top-3 pt-3" />
            </UPageAside>
        </template>
    </UPage>
</template>
