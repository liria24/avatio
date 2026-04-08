<script setup lang="ts">
import { SetupsViewerItem } from '#components'

const id = useRouteParams('id', undefined, { transform: String })

const { app } = useAppConfig()
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { session } = useAuth()
const { share, isSupported: shareSupported } = useShare()
const location = useBrowserLocation()
const { copy, copied } = useClipboard({ source: location.value.href })
const overlay = useOverlay()
const imageViewer = useImageViewerModal()
const login = useLoginModal({ props: { callbackURL: route.fullPath } })
const reportSetup = useReportSetupModal({ props: { setupId: id.value } })
const setupHide = useSetupHideModal({ props: { setupId: id.value } })
const setupUnhide = useSetupUnhideModal({ props: { setupId: id.value } })
const { toggle: toggleBookmarkAction, getBookmarkStatus } = useBookmarks()

if (!id.value)
    throw showError({
        status: 400,
        statusText: t('errors.invalidId'),
    })

const { data: setup, status } = await useSetup(id.value)

if (status.value === 'error' || (status.value === 'success' && !setup.value))
    throw showError({
        status: 404,
        statusText: t('errors.setupNotFound'),
    })

const {
    isBookmarked,
    status: bookmarkStatus,
    refresh: bookmarkRefresh,
} = await getBookmarkStatus(setup.value!.id, !!session.value)

const toggleBookmark = async () => {
    const success = await toggleBookmarkAction(setup.value!.id, isBookmarked.value)
    if (success) await bookmarkRefresh()
}

const itemCategory = useItemCategory()

const categorizedItems = computed(() => {
    const itemsByCategory = setup.value?.items.reduce(
        (acc, item) => {
            const category = item.category || 'other'
            if (!acc[category]) acc[category] = []
            acc[category].push(item)
            return acc
        },
        {} as Record<string, SetupItem[]>,
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

const shareButtons = computed(() =>
    [
        { network: 'x', icon: 'mingcute:social-x-fill', label: 'X' },
        { network: 'bluesky', icon: 'mingcute:bluesky-social-fill', label: 'Bluesky' },
        { network: 'line', icon: 'mingcute:line-app-fill', label: 'Line' },
    ].map(({ network, icon, label }) => ({
        shareUrl: useSocialShare({
            network,
            title: setup.value?.name,
            image: setup.value?.images?.[0]?.url || undefined,
        }).value?.shareUrl,
        icon,
        label,
    })),
)

onBeforeRouteLeave(() => {
    overlay.closeAll()
})

if (!setup.value?.public) useSeoMeta({ robots: 'noindex, nofollow' })

useSeo({
    title: `${setup.value?.name} @${setup.value?.user.name}`,
    description: setup.value?.description || undefined,
    image: setup.value?.images?.[0]?.url || undefined,
    twitterCard: 'summary_large_image',
    schemaOrg: {
        webPage: {
            datePublished: setup.value?.createdAt,
            dateModified: setup.value?.updatedAt,
            author: {
                username: setup.value?.user.username || '',
                name: setup.value?.user.name || '',
                description: setup.value?.user.bio || undefined,
                image: setup.value?.user.image || undefined,
            },
            breadcrumb: [
                { name: setup.value?.user.name || '', item: `/@${setup.value?.user.username}` },
                { name: setup.value?.name || '', item: `/setup/${id}` },
            ],
        },
    },
})
</script>

<template>
    <UPage
        v-if="setup"
        :ui="{
            center: 'lg:col-span-7 my-3 flex w-full flex-col items-start gap-10',
            right: 'lg:col-span-3',
        }"
    >
        <LazyUAlert
            v-if="setup.hidAt"
            icon="mingcute:eye-close-fill"
            :title="$t('setup.viewer.hiddenNotice')"
            :description="`${$t('setup.viewer.reason')}: ${setup.hidReason || $t('setup.viewer.reasonUnknown')}`"
            variant="subtle"
            :actions="[
                {
                    to: `mailto:${app.mailaddress}?subject=${$t('setup.viewer.objectToHidingSubject')}%20(ID: ${setup?.id})`,
                    target: '_blank',
                    external: true,
                    label: $t('setup.viewer.objectToHiding'),
                    variant: 'soft',
                },
            ]"
            class="w-full"
        />

        <NuxtImg
            v-if="setup.images?.length && setup.images[0]"
            v-slot="{ src, imgAttrs, isLoaded }"
            :src="setup.images[0].url"
            :width="
                setup.images[0].height > 720
                    ? Math.round((setup.images[0].width * 720) / setup.images[0].height)
                    : setup.images[0].width
            "
            :height="Math.min(setup.images[0].height, 720)"
            format="avif"
            preload
            custom
        >
            <img
                v-if="isLoaded"
                v-bind="imgAttrs"
                :src
                :alt="`${setup.name}${$t('setup.viewer.imageAlt')}`"
                loading="eager"
                fetchpriority="high"
                class="max-h-180 w-fit shrink-0 grow-0 cursor-zoom-in overflow-hidden rounded-lg object-contain"
                @click="
                    imageViewer.open({
                        src: setup.images[0].url,
                        alt: setup.name,
                    })
                "
            />
            <USkeleton
                v-else
                :style="{
                    aspectRatio: setup.images[0].width / setup.images[0].height,
                }"
                class="max-h-180 w-full shrink-0 grow-0 rounded-lg"
            />
        </NuxtImg>

        <div class="flex w-full flex-col gap-6">
            <div class="flex items-center gap-2">
                <h1 class="text-highlighted sentence text-3xl font-bold">
                    {{ setup.name }}
                </h1>

                <div class="ml-auto flex items-center gap-1">
                    <UButton
                        loading-auto
                        :loading="bookmarkStatus === 'pending'"
                        :icon="isBookmarked ? 'mingcute:bookmark-fill' : 'mingcute:bookmark-line'"
                        :aria-label="
                            isBookmarked
                                ? $t('setup.viewer.unbookmark')
                                : $t('setup.viewer.bookmark')
                        "
                        :color="isBookmarked ? 'secondary' : 'primary'"
                        variant="outline"
                        :ui="{
                            base: 'ring-muted p-2 rounded-lg',
                            leadingIcon: 'size-4.5',
                        }"
                        @click="session ? toggleBookmark() : login.open()"
                    />
                </div>
            </div>

            <SetupsViewerInfo :setup class="w-full" />

            <p
                v-if="setup.description?.length"
                class="sentence text-toned text-sm/relaxed whitespace-pre-wrap"
            >
                {{ setup.description }}
            </p>
        </div>

        <div class="flex w-full flex-col gap-7">
            <div
                v-for="(items, key) in categorizedItems"
                :key="`category-${key}`"
                class="flex flex-col gap-4 empty:hidden"
            >
                <template v-if="items?.length">
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
                            {{ itemCategory[key as keyof typeof itemCategory]?.label || key }}
                        </h2>
                    </div>
                    <SetupsViewerItem
                        v-for="(item, index) in items"
                        :key="`item-${key}-${index}`"
                        :item
                        :show-nsfw="session?.user.settings?.showNSFW"
                    />
                </template>
            </div>

            <template v-if="setup.failedItemsCount">
                <USeparator />

                <UAlert
                    icon="mingcute:question-fill"
                    :title="`${setup.failedItemsCount} ${$t('setup.viewer.failedItemsCount')}`"
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

        <div class="flex w-full flex-wrap items-center justify-end gap-1.5">
            <UFieldGroup size="sm" class="mr-auto">
                <UButton
                    :icon="copied ? 'mingcute:check-fill' : 'mingcute:link-fill'"
                    :label="copied ? $t('shareButton.copied') : $t('shareButton.copyLink')"
                    variant="ghost"
                    @click="
                        copy(location.href)
                            .then(() => {
                                toast.add({
                                    id: 'link-copied',
                                    icon: 'mingcute:check-line',
                                    title: $t('shareButton.linkCopied'),
                                })
                            })
                            .catch(() => {
                                toast.add({
                                    id: 'link-copy-failed',
                                    icon: 'mingcute:close-line',
                                    title: $t('shareButton.linkCopyFailed'),
                                    color: 'error',
                                })
                            })
                    "
                />
                <UButton
                    v-for="share in shareButtons"
                    :to="share.shareUrl"
                    target="_blank"
                    external
                    :aria-label="share.label"
                    :icon="share.icon"
                    variant="ghost"
                />
                <UButton
                    v-if="shareSupported"
                    icon="mingcute:share-2-fill"
                    variant="ghost"
                    @click="
                        share({
                            title: setup?.name,
                            text: setup?.description || undefined,
                            url: location.href,
                        })
                    "
                />
            </UFieldGroup>

            <UButton
                v-if="session?.user.role === 'admin'"
                :icon="setup.hidAt ? 'mingcute:eye-2-fill' : 'mingcute:eye-close-fill'"
                :label="setup.hidAt ? $t('setup.viewer.show') : $t('setup.viewer.hide')"
                variant="ghost"
                size="sm"
                @click="setup.hidAt ? setupUnhide.open() : setupHide.open()"
            />

            <UButton
                icon="mingcute:flag-3-fill"
                :label="$t('report')"
                variant="ghost"
                size="sm"
                @click="session ? reportSetup.open() : login.open()"
            />
        </div>

        <template #right>
            <UPageAside>
                <SetupsViewerInfo :setup sidebar class="sticky top-3 pt-3" />
            </UPageAside>
        </template>
    </UPage>
</template>
