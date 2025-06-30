<script lang="ts" setup>
interface Props {
    item: SetupItem
    actions?: boolean
    class?: string | string[] | null
}
const props = withDefaults(defineProps<Props>(), {
    actions: true,
    class: null,
})

const toast = useToast()

const nsfwMask = ref(props.item.nsfw)

const url = `https://booth.pm/ja/items/${props.item.id}`
const item = ref<SetupItem>({
    ...props.item,
    note: props.item.note || '',
    unsupported: props.item.unsupported,
    shapekeys: props.item.shapekeys,
})

const copy = (key: { name: string; value: number }) => {
    navigator.clipboard.writeText(key.value.toString())
    toast.add({ title: `${key.name} の値をコピーしました` })
}
</script>

<template>
    <div
        :class="
            cn(
                'ring-accented relative flex flex-col gap-2 overflow-clip rounded-lg p-2 ring-1',
                props.class
            )
        "
    >
        <div class="flex items-stretch gap-3">
            <NuxtLink
                :to="url"
                target="_blank"
                class="flex shrink-0 items-center overflow-hidden rounded-lg object-cover select-none"
            >
                <NuxtImg
                    v-slot="{ isLoaded, src, imgAttrs }"
                    :src="item.image || undefined"
                    :alt="item.name"
                    :width="80"
                    :height="80"
                    format="webp"
                    :data-nsfw="item.nsfw"
                >
                    <img
                        v-if="isLoaded"
                        v-bind="imgAttrs"
                        :src="src"
                        class="aspect-square size-20 shrink-0 rounded-lg object-cover text-xs data-[nsfw=true]:blur-md"
                    />
                    <USkeleton
                        v-else
                        class="aspect-square size-20 shrink-0 rounded-lg text-xs"
                    />
                </NuxtImg>
            </NuxtLink>

            <div class="flex w-full justify-between gap-1 self-stretch">
                <div class="flex grow flex-col gap-2 self-center py-1.5">
                    <NuxtLink
                        :to="url"
                        target="_blank"
                        class="flex items-center gap-3"
                    >
                        <p
                            class="line-clamp-3 text-left text-sm/relaxed font-semibold wrap-anywhere break-keep sm:text-base/relaxed"
                            v-html="useLineBreak(item.name)"
                        />
                    </NuxtLink>

                    <div
                        class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-0.5"
                    >
                        <UPopover mode="hover">
                            <NuxtLink
                                :to="`https://${item.shop.id}.booth.pm/`"
                                target="_blank"
                                class="flex w-fit items-center gap-1.5"
                            >
                                <NuxtImg
                                    v-slot="{ isLoaded, src, imgAttrs }"
                                    :src="item.shop.image ?? ''"
                                    :alt="item.shop.name"
                                    :width="20"
                                    :height="20"
                                    format="webp"
                                >
                                    <img
                                        v-if="isLoaded"
                                        v-bind="imgAttrs"
                                        :src="src"
                                        class="ring-accented aspect-square size-5 shrink-0 rounded-md object-cover ring-1"
                                    />
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
                                <div
                                    class="flex items-center gap-3 py-2 pr-3 pl-2"
                                >
                                    <NuxtImg
                                        v-slot="{ isLoaded, src, imgAttrs }"
                                        :src="item.shop.image || undefined"
                                        :alt="item.shop.name"
                                        :width="40"
                                        :height="40"
                                        format="webp"
                                    >
                                        <img
                                            v-if="isLoaded"
                                            v-bind="imgAttrs"
                                            :src="src"
                                            class="aspect-square size-10 shrink-0 rounded-md object-cover"
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
                                        <NuxtLink
                                            :to="`https://${item.shop.id}.booth.pm/`"
                                            target="_blank"
                                            class="text-muted text-xs leading-none font-semibold"
                                        >
                                            {{ item.shop.id }}.booth.pm
                                        </NuxtLink>
                                    </div>
                                </div>
                            </template>
                        </UPopover>

                        <NuxtLink
                            :to="url"
                            target="_blank"
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
                        </NuxtLink>

                        <NuxtLink
                            :to="url"
                            target="_blank"
                            class="flex w-fit items-center gap-1.5"
                        >
                            <Icon
                                name="mingcute:heart-fill"
                                :size="18"
                                class="text-muted shrink-0"
                            />
                            <p
                                class="text-muted pt-px font-[Geist] text-xs leading-none font-semibold text-nowrap"
                            >
                                {{ item.likes?.toLocaleString() || '?' }}
                            </p>
                        </NuxtLink>

                        <UBadge
                            v-if="item.nsfw"
                            icon="lucide:ban"
                            label="NSFW"
                            variant="soft"
                            class="text-xs font-semibold"
                        />
                    </div>
                </div>

                <UTooltip
                    v-if="props.actions"
                    text="このアイテムを含むセットアップを検索"
                >
                    <UButton
                        :to="$localePath(`/search?itemId=${props.item.id}`)"
                        icon="lucide:search"
                        aria-label="このアイテムを含むセットアップを検索"
                        variant="ghost"
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
                                        @click="copy(key)"
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
