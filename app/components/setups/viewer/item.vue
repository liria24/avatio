<script lang="ts" setup>
import { withoutProtocol, withoutTrailingSlash } from 'ufo'

interface Props {
    item: SetupItem
    showNsfw?: boolean
}
const { item, showNsfw = false } = defineProps<Props>()

const toast = useToast()
const { copy } = useClipboard()
const reportItem = useReportItemModal()
const login = useLoginModal()
const { session } = useAuth()

const nsfwMask = createRef(item.nsfw && !showNsfw)

const shopPath = computed(() =>
    withoutTrailingSlash(withoutProtocol(resolveShopUrl(item.shop?.id, item.shop?.platform) || '')),
)

const providerIcon = computed(() => getPlatformData(item.platform).icon)
</script>

<template>
    <div
        class="bg-muted/30 ring-accented relative grid grid-flow-col grid-cols-[88px_auto] grid-rows-[auto_auto] gap-4 overflow-clip rounded-xl p-3 ring-1 sm:grid-cols-[max-content_auto] sm:p-4"
    >
        <UDropdownMenu
            :items="[
                {
                    to: $localePath(`/search?itemId=${item.id}`),
                    icon: 'mingcute:search-line',
                    label: $t('setup.viewer.searchByItem'),
                },
                {
                    icon: 'mingcute:flag-3-fill',
                    label: $t('setup.viewer.reportItem'),
                    onClick: () => (session ? reportItem.open({ itemId: item.id }) : login.open()),
                },
            ]"
        >
            <UButton
                :aria-label="$t('setup.viewer.showActions')"
                icon="mingcute:more-2-line"
                variant="ghost"
                class="absolute top-2 right-2"
            />
        </UDropdownMenu>

        <NuxtLink
            :to="resolveItemUrl(item.id, item.platform)"
            target="_blank"
            external
            :aria-label="item.name"
            :class="
                cn(
                    'relative row-span-2 size-fit shrink-0 select-none',
                    (item.note?.length || item.unsupported || item.shapekeys?.length) &&
                        'row-span-1 sm:row-span-2',
                )
            "
        >
            <template v-if="item.image">
                <NuxtImg
                    :src="item.image || undefined"
                    :width="256"
                    :height="256"
                    format="avif"
                    alt=""
                    loading="lazy"
                    fetchpriority="low"
                    class="aspect-square size-22 overflow-hidden rounded-lg object-cover text-xs sm:size-28"
                />
                <div
                    class="inset-ring-inverted/15 pointer-events-none absolute inset-0 rounded-md inset-ring-2"
                />
            </template>
            <div
                v-else
                class="bg-muted flex aspect-square size-22 items-center justify-center rounded-lg sm:size-28"
            >
                <Icon :name="providerIcon" size="24" class="text-muted" />
            </div>
        </NuxtLink>

        <div
            :class="
                cn(
                    'order-last row-span-2 flex flex-col justify-center gap-2 sm:order-0',
                    (item.note?.length || item.unsupported || item.shapekeys?.length) &&
                        'row-span-1 sm:pt-1',
                )
            "
        >
            <NuxtLink
                :to="resolveItemUrl(item.id, item.platform)"
                target="_blank"
                external
                prefetch
                class="sentence line-clamp-2 pr-8 text-left text-sm/relaxed font-semibold sm:text-base/relaxed"
            >
                {{ item.name }}
            </NuxtLink>

            <div
                :class="
                    cn(
                        'flex flex-wrap items-center gap-y-2',
                        '[&>*:not(:first-child)]:before:bg-accented [&>*:not(:first-child)]:relative [&>*:not(:first-child)]:before:absolute [&>*:not(:first-child)]:before:top-1/2 [&>*:not(:first-child)]:before:left-0 [&>*:not(:first-child)]:before:h-3 [&>*:not(:first-child)]:before:w-px [&>*:not(:first-child)]:before:-translate-y-1/2 [&>*:not(:first-child)]:before:content-[\'\']',
                    )
                "
            >
                <UTooltip
                    v-if="item.shop"
                    :delay-duration="100"
                    :content="{ side: 'top' }"
                    :ui="{ content: 'flex flex-col items-start h-fit px-4 py-3 rounded-lg' }"
                >
                    <NuxtLink
                        :to="resolveShopUrl(item.shop.id, item.shop.platform)"
                        target="_blank"
                        external
                        prefetch
                        class="flex shrink-0 items-center justify-center pr-2"
                    >
                        <div v-if="item.shop.image" class="relative">
                            <NuxtImg
                                :src="item.shop.image"
                                :alt="item.shop.name || ''"
                                :width="24"
                                :height="24"
                                format="avif"
                                loading="lazy"
                                fetchpriority="low"
                                class="aspect-square size-6 rounded-md object-cover"
                            />
                            <div
                                class="inset-ring-inverted/10 pointer-events-none absolute inset-0 rounded-md inset-ring-1"
                            />
                        </div>
                        <Icon v-else :name="providerIcon" size="16" class="text-muted mt-1" />
                    </NuxtLink>

                    <template #content>
                        <p class="text-sm">
                            {{ item.shop.name }}
                        </p>
                        <p class="text-muted">
                            {{ shopPath }}
                        </p>
                    </template>
                </UTooltip>

                <span
                    v-if="item.price"
                    class="text-muted px-2 font-mono text-xs leading-none text-nowrap"
                >
                    {{ item.price }}
                </span>

                <div v-if="item.likes !== null" class="flex w-fit items-center gap-1.5 px-2">
                    <Icon
                        v-if="item.platform === 'github'"
                        name="mingcute:star-line"
                        :size="15"
                        class="text-muted shrink-0"
                    />
                    <Icon
                        v-else
                        name="mingcute:heart-line"
                        :size="15"
                        class="text-muted shrink-0"
                    />
                    <span class="text-muted font-mono text-xs leading-none text-nowrap">
                        {{ item.likes.toLocaleString() }}
                    </span>
                </div>

                <div
                    v-if="item.forks !== null && item.forks !== undefined"
                    class="flex w-fit items-center gap-1.5 px-2"
                >
                    <Icon name="mingcute:git-branch-line" :size="15" class="text-muted shrink-0" />
                    <span class="text-muted font-mono text-xs leading-none text-nowrap">
                        {{ item.forks.toLocaleString() }}
                    </span>
                </div>

                <div v-if="item.version" class="flex w-fit items-center gap-1.5 px-2">
                    <Icon name="mingcute:tag-line" :size="15" class="text-muted shrink-0" />
                    <span class="text-muted font-mono text-xs leading-none text-nowrap">
                        {{ item.version }}
                    </span>
                </div>

                <LazyUAvatarGroup v-if="item.contributors?.length" :max="3" size="2xs" class="px-2">
                    <UTooltip
                        v-for="contributor in item.contributors"
                        :key="encodeURIComponent(contributor.name)"
                        :text="contributor.name"
                        :delay-duration="100"
                    >
                        <UAvatar
                            :src="`https://github.com/${contributor.name}.png`"
                            :alt="contributor.name"
                            icon="mingcute:user-3-fill"
                        />
                    </UTooltip>
                </LazyUAvatarGroup>

                <LazyUBadge
                    v-if="item.nsfw"
                    icon="mingcute:forbid-circle-fill"
                    label="NSFW"
                    variant="soft"
                    class="px-2 font-mono text-xs font-semibold"
                />
            </div>
        </div>

        <div
            :data-noted="!!item.note?.length"
            class="border-muted/60 col-span-2 flex items-end justify-end gap-1.5 border-t pt-2 empty:hidden sm:col-span-1 sm:mt-auto"
        >
            <div v-if="item.note?.length" class="my-auto flex grow items-start gap-2">
                <Icon
                    name="mingcute:edit-3-fill"
                    :size="15"
                    class="text-muted/60 mt-[0.2rem] shrink-0"
                />
                <p class="sentence text-xs/relaxed whitespace-pre-wrap">
                    {{ item.note }}
                </p>
            </div>

            <UTooltip
                v-if="item.unsupported"
                :text="$t('setup.viewer.unavailableForAvatar')"
                :delay-duration="100"
            >
                <div class="bg-muted flex items-center justify-center gap-2 rounded-lg p-2">
                    <Icon name="mingcute:user-x-fill" :size="15" class="text-muted shrink-0" />
                </div>
            </UTooltip>

            <UPopover
                :content="{
                    align: 'center',
                    side: 'right',
                    sideOffset: 8,
                }"
            >
                <UButton
                    v-if="item.shapekeys?.length"
                    icon="mingcute:union-fill"
                    :label="item.shapekeys.length.toString()"
                    variant="soft"
                    size="sm"
                    class="rounded-lg p-2"
                />

                <template #content>
                    <div class="flex min-w-48 flex-col gap-3 p-3">
                        <div class="flex w-full items-center gap-2">
                            <Icon
                                name="mingcute:union-fill"
                                :size="18"
                                class="text-muted shrink-0"
                            />
                            <p class="text-sm font-medium">
                                {{ $t('setup.viewer.shapekeys') }}
                            </p>
                        </div>
                        <div class="flex flex-col gap-3 rounded-lg">
                            <div
                                v-for="(key, index) in item.shapekeys"
                                :key="'shapekey-' + index"
                                class="flex items-center justify-between gap-3"
                            >
                                <p class="text-toned text-sm leading-none text-nowrap">
                                    {{ key.name }}
                                </p>
                                <UButton
                                    :label="
                                        key.value.toLocaleString(undefined, {
                                            minimumFractionDigits: 1,
                                            maximumFractionDigits: 4,
                                        })
                                    "
                                    variant="soft"
                                    size="sm"
                                    @click="
                                        copy(key.value.toString()).then(() => {
                                            toast.add({
                                                id: `copy-shapekey-${index}`,
                                                title: $t('setup.viewer.valueCopied', {
                                                    name: key.name,
                                                }),
                                            })
                                        })
                                    "
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </UPopover>
        </div>

        <div
            v-if="nsfwMask"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-3 backdrop-blur-xl"
        >
            <UButton
                icon="mingcute:eye-2-fill"
                :label="$t('setup.viewer.showNsfw')"
                variant="soft"
                @click="nsfwMask = false"
            />
        </div>
    </div>
</template>
