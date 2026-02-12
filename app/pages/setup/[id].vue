<script setup lang="ts">
import { SetupsViewerItem } from '#components'

const { app } = useAppConfig()
const route = useRoute()
const { reportSetup, imageViewer, login, setupDelete, setupHide, setupUnhide } = useAppOverlay()
const { t } = useI18n()

const id = Number(route.params.id)

// Handle invalid IDs (null, undefined, NaN, etc.)
if (!id || isNaN(id) || id <= 0)
    throw showError({
        status: 400,
        statusText: t('errors.invalidId'),
    })

const { data, status } = await useSetup(id)

if (status.value === 'error' || (status.value === 'success' && !data.value))
    throw showError({
        status: 404,
        statusText: t('errors.setupNotFound'),
    })

const itemCategory = useItemCategory()

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

    // itemCategoryで定義された順序でプロパティを追加
    for (const categoryKey of Object.keys(itemCategory))
        if (itemsByCategory[categoryKey])
            orderedCategories[categoryKey] = itemsByCategory[categoryKey]

    // itemCategoryに定義されていないカテゴリがあれば最後に追加
    for (const [categoryKey, items] of Object.entries(itemsByCategory))
        if (!orderedCategories[categoryKey]) orderedCategories[categoryKey] = items

    return orderedCategories
})

const isInitialLoad = ref(true)
onMounted(async () => {
    await setTimeout(() => {
        isInitialLoad.value = false
    }, 100)
})

onBeforeRouteLeave(() => {
    reportSetup.close()
    imageViewer.close()
    login.close()
    setupHide.close()
    setupUnhide.close()
    setupDelete.close()
})

if (data.value) {
    defineSeo({
        title: `${data.value.name} @${data.value.user.name}`,
        description: data.value.description || undefined,
        image:
            data.value.images?.length && data.value.images[0]
                ? data.value.images[0].url
                : 'https://avatio.me/ogp.png',
        twitterCard: 'summary_large_image',
    })
    useSchemaOrg([
        defineWebPage({
            name: data.value.name,
            description: data.value.description,
            datePublished: data.value.createdAt,
            author: {
                '@type': 'Person',
                name: data.value.user.name,
                url: `/@${data.value.user.username}`,
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
    <UPage v-if="data" :ui="{ center: 'lg:col-span-7', right: 'lg:col-span-3' }">
        <UBreadcrumb
            :items="[
                { label: data.user.name, to: `/@${data.user.username}` },
                { label: data.name },
            ]"
            :ui="{ link: 'text-xs', separatorIcon: 'size-4' }"
        />

        <UPageBody>
            <div class="flex w-full flex-col items-start gap-10">
                <UAlert
                    v-if="data.hidAt"
                    icon="mingcute:eye-close-fill"
                    :title="$t('setup.viewer.hiddenNotice')"
                    :description="`${$t('setup.viewer.reason')}: ${data.hidReason || $t('setup.viewer.reasonUnknown')}`"
                    variant="subtle"
                    :actions="[
                        {
                            label: $t('setup.viewer.objectToHiding'),
                            variant: 'soft',
                            onClick: () => {
                                navigateTo(
                                    `mailto:${app.mailaddress}?subject=${$t('setup.viewer.objectToHidingSubject')}%20(ID: ${data?.id})`,
                                    {
                                        external: true,
                                        open: { target: '_blank' },
                                    }
                                )
                            },
                        },
                    ]"
                    class="w-full"
                />

                <NuxtImg
                    v-if="data.images?.length && data.images[0]"
                    v-slot="{ src, imgAttrs, isLoaded }"
                    :src="data.images[0].url"
                    :width="
                        data.images[0].height > 720
                            ? Math.round((data.images[0].width * 720) / data.images[0].height)
                            : data.images[0].width
                    "
                    :height="Math.min(data.images[0].height, 720)"
                    format="avif"
                    preload
                    custom
                >
                    <img
                        v-if="isLoaded"
                        v-bind="imgAttrs"
                        :src
                        :alt="`${data.name}${$t('setup.viewer.imageAlt')}`"
                        loading="eager"
                        fetchpriority="high"
                        class="max-h-180 w-fit shrink-0 grow-0 cursor-zoom-in overflow-hidden rounded-lg object-contain"
                        @click="
                            imageViewer.open({
                                src: data.images[0].url,
                                alt: data.name,
                            })
                        "
                    />
                    <USkeleton
                        v-else
                        :style="{
                            aspectRatio: data.images[0].width / data.images[0].height,
                        }"
                        class="max-h-180 w-full shrink-0 grow-0 rounded-lg"
                    />
                </NuxtImg>

                <SetupsViewerInfo :setup="data" class="w-full" />

                <div class="flex w-full flex-col gap-7">
                    <div
                        v-for="(value, key) in categorizedItems"
                        :key="'category-' + key"
                        class="flex flex-col gap-4 empty:hidden"
                    >
                        <template v-if="value?.length">
                            <div class="flex items-center gap-2">
                                <Icon
                                    :name="
                                        itemCategory[key as keyof typeof itemCategory]?.icon ||
                                        'mingcute:box-3-fill'
                                    "
                                    :size="22"
                                    class="text-muted shrink-0"
                                />
                                <h2 class="text-lg leading-none font-semibold text-nowrap">
                                    {{
                                        itemCategory[key as keyof typeof itemCategory]?.label || key
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
                            icon="mingcute:question-fill"
                            :title="`${data.failedItemsCount} ${$t('setup.viewer.failedItemsCount')}`"
                            :description="$t('setup.viewer.deleted')"
                            variant="subtle"
                            orientation="horizontal"
                            :actions="[
                                {
                                    label: $t('errors.reportBug'),
                                    to: 'https://github.com/liria24/avatio/issues/new?template=%F0%9F%9A%A7-bug-report.md',
                                    target: '_blank',
                                    variant: 'soft',
                                },
                            ]"
                        />
                    </template>
                </div>

                <UButton
                    icon="mingcute:flag-3-fill"
                    :label="$t('setup.viewer.report')"
                    variant="ghost"
                    size="sm"
                    class="ml-auto"
                    @click="reportSetup.open({ setupId: id })"
                />
            </div>
        </UPageBody>

        <template #right>
            <UPageAside>
                <SetupsViewerInfo :setup="data" sidebar class="sticky top-3 pt-3" />
            </UPageAside>
        </template>
    </UPage>
</template>
