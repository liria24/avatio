<script setup lang="ts">
import { cn } from 'cn'

import { SetupsViewerItem } from '#components'

const id = useRouteParams('id', undefined, { transform: String })

const { app } = useAppConfig()
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { user, loggedIn, preferences } = useViewerContext()
const { share, isSupported: shareSupported } = useShare()
const location = useBrowserLocation()
const { copy, copied } = useClipboard({ source: location.value.href })
const overlay = useOverlay()
const login = useLoginModal({ props: { callbackURL: route.fullPath } })
const reportSetup = useReportSetupModal({ props: { setupId: id.value } })
const reportItem = useReportItemModal()
const setupHide = useSetupHideModal({ props: { setupId: id.value } })
const setupUnhide = useSetupUnhideModal({ props: { setupId: id.value } })
const { toggle: toggleBookmarkAction, getBookmarkStatus } = useBookmarks()
const setupPath = useSetupPath()

if (!id.value)
    throw showError({
        status: 400,
        statusText: t('errors.invalidId'),
    })

const canonicalPath = setupPath(id.value)
if (route.path !== canonicalPath)
    await navigateTo(
        { path: canonicalPath, query: route.query },
        { redirectCode: 308, replace: true },
    )

const { data: setup, status } = loggedIn.value ? await useViewerSetup(id) : await useSetup(id)

if (status.value === 'error' || (status.value === 'success' && !setup.value))
    throw showError({
        status: 404,
        statusText: t('errors.setupNotFound'),
    })

const {
    isBookmarked,
    status: bookmarkStatus,
    refresh: bookmarkRefresh,
} = await getBookmarkStatus(setup.value!.id, loggedIn.value)

const toggleBookmark = async () => {
    const success = await toggleBookmarkAction(setup.value!.id, isBookmarked.value)
    if (success) await bookmarkRefresh()
}

const itemCategory = useItemCategory()
const gallery = ref<{ showEntry: (entryId: string) => void }>()
const highlightedEntryId = ref<string>()

const selectEntry = async (entryId: string) => {
    highlightedEntryId.value = entryId
    await nextTick()
    document.getElementById(`setup-entry-${entryId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    })
}

const showEntryPoints = (entryId: string) => {
    gallery.value?.showEntry(entryId)
    void selectEntry(entryId)
}

const pointCount = (entryId: string) =>
    setup.value?.points?.filter((point) => point.entryId === entryId).length ?? 0

const categorizedItems = computed(() => {
    const itemsByCategory = setup.value?.entries
        .filter((entry) => entry.catalogItem.primarySource?.availability === 'available')
        .reduce(
            (acc, item) => {
                const category = item.category || 'other'
                if (!acc[category]) acc[category] = []
                acc[category].push(item)
                return acc
            },
            {} as Record<string, SetupEntryView[]>,
        )

    const orderedCategories: Record<string, SetupEntryView[]> = {}

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
                { name: setup.value?.name || '', item: canonicalPath },
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

        <SetupsViewerGallery
            v-if="setup.images?.length"
            ref="gallery"
            :images="setup.images"
            :points="setup.points ?? []"
            :entries="setup.entries"
            :name="setup.name"
            @select-entry="selectEntry"
        />

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
                        @click="loggedIn ? toggleBookmark() : login.open()"
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
                    <div
                        v-for="(item, index) in items"
                        :key="`item-${key}-${index}`"
                        :id="`setup-entry-${item.id}`"
                        :class="
                            cn(
                                'scroll-mt-4 rounded-xl ring-2 ring-transparent transition-all',
                                highlightedEntryId === item.id && 'ring-primary',
                            )
                        "
                    >
                        <SetupsViewerItem
                            :entry="item"
                            :show-nsfw="preferences.showNsfw"
                            :point-count="pointCount(item.id)"
                            @show-points="showEntryPoints(item.id)"
                            @report-item="
                                loggedIn ? reportItem.open({ itemId: $event }) : login.open()
                            "
                        />
                    </div>
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
                v-if="user?.role === 'admin'"
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
                @click="loggedIn ? reportSetup.open() : login.open()"
            />
        </div>

        <template #right>
            <UPageAside>
                <SetupsViewerInfo :setup sidebar class="sticky top-3 pt-3" />
            </UPageAside>
        </template>
    </UPage>
</template>
