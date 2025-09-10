<script lang="ts" setup>
import { parseURL } from 'ufo'
import { LazyModalReportItem } from '#components'

interface Props {
    item: SetupItem
    actions?: boolean
    class?: string | string[] | null
}
const props = withDefaults(defineProps<Props>(), {
    actions: true,
    class: null,
})

const overlay = useOverlay()
const toast = useToast()
const { copy } = useClipboard()

const nsfwMask = ref(props.item.nsfw)
const modalReport = overlay.create(LazyModalReportItem, {
    props: { itemId: props.item.id },
})

const shopPath = computed(() => {
    const url = parseURL(
        computeShopUrl(props.item.shop?.id, props.item.shop?.platform)
    )
    const path = url.pathname === '/' ? '' : url.pathname
    return url.host + path
})

const providerIcons = {
    booth: 'avatio:booth',
    github: 'simple-icons:github',
}
const providerIcon = computed(() => providerIcons[props.item.platform])
</script>

<template>
    <div
        :class="
            cn(
                'ring-accented relative flex flex-col gap-2 overflow-clip rounded-xl p-2 ring-1',
                props.class
            )
        "
    >
        <div class="flex items-stretch gap-1">
            <NuxtLink
                v-if="item.image"
                :to="computeItemUrl(item.id, item.platform)"
                target="_blank"
                class="flex shrink-0 items-center overflow-hidden rounded-lg object-cover select-none"
            >
                <NuxtImg
                    v-slot="{ isLoaded, src, imgAttrs }"
                    :src="item.image || undefined"
                    :alt="item.name"
                    :width="88"
                    :height="88"
                    format="webp"
                    loading="lazy"
                    fetchpriority="low"
                    custom
                    class="aspect-square size-22 shrink-0 rounded-lg object-cover text-xs"
                >
                    <img v-if="isLoaded" v-bind="imgAttrs" :src />
                    <USkeleton
                        v-else
                        class="aspect-square size-20 shrink-0 rounded-lg text-xs"
                    />
                </NuxtImg>
            </NuxtLink>

            <div class="ml-2 flex grow flex-col gap-1 self-center py-1.5">
                <div class="flex items-center gap-2">
                    <Icon
                        v-if="!item.niceName"
                        :name="providerIcon"
                        size="16"
                        class="text-muted shrink-0"
                    />

                    <NuxtLink
                        :to="computeItemUrl(item.id, item.platform)"
                        target="_blank"
                        class="flex items-center gap-3"
                    >
                        <span
                            class="text-left text-sm/relaxed font-semibold sm:text-base/relaxed"
                        >
                            {{ item.niceName || item.name }}
                        </span>
                    </NuxtLink>
                </div>

                <UButton
                    v-if="item.niceName"
                    :icon="providerIcon"
                    :label="item.name"
                    variant="link"
                    size="xs"
                    :ui="{
                        leadingIcon: 'size-3',
                        label: 'break-all line-clamp-1 whitespace-normal text-[10px]',
                    }"
                    class="p-0"
                />

                <div
                    class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-0.5"
                >
                    <UPopover v-if="item.shop" mode="hover">
                        <NuxtLink
                            :to="
                                computeShopUrl(item.shop.id, item.shop.platform)
                            "
                            target="_blank"
                            class="flex w-fit items-center gap-1.5"
                        >
                            <NuxtImg
                                v-slot="{ isLoaded, src, imgAttrs }"
                                :src="item.shop.image || undefined"
                                :alt="item.shop.name"
                                :width="24"
                                :height="24"
                                format="webp"
                                loading="lazy"
                                fetchpriority="low"
                                custom
                                class="ring-accented aspect-square size-5 shrink-0 rounded-sm object-cover ring-1"
                            >
                                <img v-if="isLoaded" v-bind="imgAttrs" :src />
                                <USkeleton
                                    v-else
                                    class="aspect-square size-5 shrink-0 rounded-md"
                                />
                            </NuxtImg>
                            <span
                                class="text-muted text-xs font-semibold text-nowrap"
                            >
                                {{ item.shop.name }}
                            </span>
                            <Icon
                                v-if="item.shop.verified"
                                name="lucide:check"
                                :size="16"
                                class="text-muted size-3 shrink-0"
                            />
                        </NuxtLink>

                        <template #content>
                            <NuxtLink
                                :to="
                                    computeShopUrl(
                                        item.shop.id,
                                        item.shop.platform
                                    )
                                "
                                target="_blank"
                                class="flex items-center gap-3 py-2 pr-3 pl-2"
                            >
                                <NuxtImg
                                    v-slot="{ isLoaded, src, imgAttrs }"
                                    :src="item.shop.image || undefined"
                                    :alt="item.shop.name"
                                    :width="48"
                                    :height="48"
                                    format="webp"
                                    loading="lazy"
                                    fetchpriority="low"
                                    custom
                                    class="aspect-square size-10 shrink-0 rounded-md object-cover"
                                >
                                    <img
                                        v-if="isLoaded"
                                        v-bind="imgAttrs"
                                        :src="src"
                                    />
                                    <USkeleton
                                        v-else
                                        class="aspect-square size-10 shrink-0 rounded-md"
                                    />
                                </NuxtImg>
                                <div class="flex flex-col gap-1.5">
                                    <span
                                        class="text-toned text-sm leading-none font-semibold"
                                    >
                                        {{ item.shop.name }}
                                    </span>
                                    <span
                                        class="text-muted text-xs leading-none font-semibold"
                                    >
                                        {{ shopPath }}
                                    </span>
                                </div>
                            </NuxtLink>
                        </template>
                    </UPopover>

                    <div
                        v-if="item.price"
                        class="flex w-fit items-center gap-1.5"
                    >
                        <Icon
                            name="mingcute:currency-cny-fill"
                            :size="18"
                            class="text-muted shrink-0"
                        />
                        <span
                            class="text-muted pt-px font-[Geist] text-xs leading-0 font-semibold text-nowrap"
                        >
                            {{ item.price }}
                        </span>
                    </div>

                    <div
                        v-if="item.likes !== null"
                        class="flex w-fit items-center gap-1.5"
                    >
                        <Icon
                            v-if="item.platform === 'github'"
                            name="mingcute:star-fill"
                            :size="18"
                            class="text-muted shrink-0"
                        />
                        <Icon
                            v-else
                            name="mingcute:heart-fill"
                            :size="18"
                            class="text-muted shrink-0"
                        />
                        <span
                            class="text-muted pt-px font-[Geist] text-xs leading-none font-semibold text-nowrap"
                        >
                            {{ item.likes.toLocaleString() }}
                        </span>
                    </div>

                    <div
                        v-if="item.forks !== null && item.forks !== undefined"
                        class="flex w-fit items-center gap-1.5"
                    >
                        <Icon
                            name="lucide:git-fork"
                            :size="17"
                            class="text-muted shrink-0"
                        />
                        <span
                            class="text-muted pt-px font-[Geist] text-xs leading-none font-semibold text-nowrap"
                        >
                            {{ item.forks.toLocaleString() }}
                        </span>
                    </div>

                    <div
                        v-if="item.version"
                        class="flex w-fit items-center gap-1.5"
                    >
                        <Icon
                            name="lucide:tag"
                            :size="16"
                            class="text-muted shrink-0"
                        />
                        <span
                            class="text-muted pt-px font-[Geist] text-xs leading-none font-semibold text-nowrap"
                        >
                            {{ item.version }}
                        </span>
                    </div>

                    <UAvatarGroup
                        v-if="item.contributors?.length"
                        :max="3"
                        size="2xs"
                        class=""
                    >
                        <UTooltip
                            v-for="contributor in item.contributors"
                            :key="encodeURIComponent(contributor.name)"
                            :text="contributor.name"
                            :delay-duration="100"
                        >
                            <UAvatar
                                :src="`https://github.com/${contributor.name}.png`"
                                :alt="contributor.name"
                                icon="lucide:user-round"
                            />
                        </UTooltip>
                    </UAvatarGroup>

                    <UBadge
                        v-if="item.nsfw"
                        icon="lucide:ban"
                        label="NSFW"
                        variant="soft"
                        class="text-xs font-semibold"
                    />
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <UTooltip
                    v-if="props.actions"
                    text="アイテムからセットアップを検索"
                    :delay-duration="50"
                    :content="{ side: 'top' }"
                >
                    <UButton
                        :to="$localePath(`/search?itemId=${props.item.id}`)"
                        icon="lucide:search"
                        aria-label="アイテムからセットアップを検索"
                        variant="ghost"
                        :ui="{ leadingIcon: 'size-4.5' }"
                        class="grow"
                    />
                </UTooltip>

                <UTooltip
                    v-if="props.actions"
                    text="アイテムを報告"
                    :delay-duration="50"
                >
                    <UButton
                        icon="lucide:flag"
                        aria-label="アイテムを報告"
                        variant="ghost"
                        :ui="{
                            base: 'justify-center',
                            leadingIcon: 'size-4 text-dimmed',
                        }"
                        @click="modalReport.open()"
                    />
                </UTooltip>
            </div>
        </div>

        <div
            :data-noted="!!item.note?.length"
            class="ring-accented flex w-full flex-col gap-1.5 rounded-lg p-2 ring-1 ring-inset empty:hidden data-[noted=false]:p-0 data-[noted=false]:ring-0"
        >
            <div v-if="item.note?.length" class="flex items-start gap-2 px-1">
                <Icon
                    name="lucide:pen-line"
                    :size="15"
                    class="text-muted mt-[0.2rem] shrink-0"
                />
                <p
                    class="text-left text-xs/relaxed wrap-anywhere break-keep whitespace-pre-wrap"
                    v-html="useLineBreak(item.note)"
                />
            </div>
            <div
                v-if="item.shapekeys?.length || item.unsupported"
                class="flex flex-wrap items-center justify-end gap-3"
            >
                <div
                    v-if="item.unsupported"
                    class="flex items-center gap-2 px-3 py-2"
                >
                    <Icon
                        name="lucide:user-round-x"
                        :size="15"
                        class="text-muted shrink-0"
                    />
                    <p
                        class="text-muted text-left text-xs leading-none font-medium"
                    >
                        アバター非対応
                    </p>
                </div>
                <UPopover
                    :content="{
                        align: 'center',
                        side: 'right',
                        sideOffset: 8,
                    }"
                >
                    <UButton
                        v-if="item.shapekeys?.length"
                        icon="lucide:shapes"
                        :label="`${item.shapekeys.length} 個のシェイプキー`"
                        variant="subtle"
                        size="sm"
                        class="rounded-lg px-3 py-2"
                    />

                    <template #content>
                        <div class="flex min-w-48 flex-col gap-3 p-3">
                            <div class="flex w-full items-center gap-2">
                                <Icon
                                    name="lucide:shapes"
                                    :size="18"
                                    class="text-muted shrink-0"
                                />
                                <p class="text-sm font-medium">シェイプキー</p>
                            </div>
                            <div class="flex flex-col gap-3 rounded-lg">
                                <div
                                    v-for="(key, index) in item.shapekeys"
                                    :key="'shapekey-' + index"
                                    class="flex items-center justify-between gap-3"
                                >
                                    <p
                                        class="text-toned text-sm leading-none text-nowrap"
                                    >
                                        {{ key.name }}
                                    </p>
                                    <UButton
                                        :label="
                                            key.value.toLocaleString(
                                                undefined,
                                                {
                                                    minimumFractionDigits: 1,
                                                    maximumFractionDigits: 4,
                                                }
                                            )
                                        "
                                        variant="soft"
                                        size="sm"
                                        @click="
                                            copy(key.value.toString()).then(
                                                () => {
                                                    toast.add({
                                                        title: `${key.name} の値をコピーしました`,
                                                    })
                                                }
                                            )
                                        "
                                    />
                                </div>
                            </div>
                        </div>
                    </template>
                </UPopover>
            </div>
        </div>

        <div
            v-if="nsfwMask"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-3 backdrop-blur-xl"
        >
            <UButton
                icon="lucide:eye"
                label="NSFW コンテンツを表示"
                variant="soft"
                @click="nsfwMask = false"
            />
        </div>
    </div>
</template>
