<script setup lang="ts">
const route = useRoute()

const id = Number(route.params.id)

const { data, status } = await useSetup(id)

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
    <div v-if="data" class="flex flex-col items-start gap-5">
        <UBreadcrumb
            :items="[
                { label: data.user.name, to: `/@${data.user.id}` },
                { label: data.name },
            ]"
            :ui="{
                link: 'text-xs',
                separatorIcon: 'size-4',
            }"
        />

        <div
            class="relative flex w-full flex-col items-start gap-8 xl:flex-row"
        >
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

                <div class="flex w-full flex-col items-start gap-1">
                    <h1
                        class="text-highlighted text-3xl font-bold wrap-anywhere break-keep"
                        v-html="useLineBreak(data.name)"
                    />
                    <div class="flex w-full items-center justify-between gap-3">
                        <div class="ml-0.5 flex items-center gap-1.5">
                            <Icon
                                name="lucide:calendar"
                                size="16"
                                class="text-muted"
                            />
                            <NuxtTime
                                v-if="data.createdAt?.length"
                                :datetime="data.createdAt"
                                class="text-muted font-[Geist] text-sm leading-none text-nowrap"
                            />
                        </div>

                        <SetupsViewerButtons
                            :id="data.id"
                            :name="data.name"
                            :images="data.images"
                            :user="data.user"
                        />
                    </div>
                </div>

                <UModal
                    v-if="data.images?.length && data.images[0]"
                    :ui="{
                        content: 'bg-transparent ring-0 max-w-xl rounded-none',
                    }"
                >
                    <NuxtImg
                        :src="data.images[0].url"
                        :alt="data.name"
                        :width="data.images[0].width"
                        :height="data.images[0].height"
                        class="max-h-[720px] w-fit shrink-0 grow-0 cursor-zoom-in overflow-hidden rounded-lg object-contain"
                    />

                    <template #content>
                        <NuxtImg
                            :src="data.images[0].url"
                            :alt="data.name"
                            class="h-full object-contain"
                        />
                    </template>
                </UModal>

                <SetupsViewerInfo
                    :setup-id="data.id"
                    :created-at="data.createdAt"
                    :title="data.name"
                    :description="data.description"
                    :tags="data.tags"
                    :co-authors="data.coauthors"
                    :user="data.user"
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
                    :setup-id="data.id"
                    :created-at="data.createdAt"
                    :title="data.name"
                    :description="data.description"
                    :tags="data.tags"
                    :coauthors="data.coauthors"
                    :user="data.user"
                    class="sticky top-3 pt-3"
                />
            </div>
        </div>
    </div>
</template>
