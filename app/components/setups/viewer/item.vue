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
                'ring-accented flex flex-col gap-2 overflow-clip rounded-lg p-2 ring-1',
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
                    preload
                    :src="item.image || undefined"
                    :alt="item.name"
                    format="webp"
                    fit="cover"
                    quality="75"
                    sizes="80px"
                    :width="80"
                    :height="80"
                    :data-nsfw="item.nsfw"
                    class="size-20 rounded-lg object-cover text-xs data-[nsfw=true]:blur-md"
                />
            </NuxtLink>

            <div class="flex w-full justify-between gap-1 self-stretch">
                <div class="flex grow flex-col gap-2 self-center py-1.5">
                    <div class="flex items-center gap-2">
                        <UTooltip v-if="item.nsfw" text="NSFW">
                            <Icon
                                name="lucide:heart"
                                :size="18"
                                class="text-pink-400"
                            />
                        </UTooltip>
                        <NuxtLink :to="url" target="_blank" class="w-fit gap-2">
                            <p
                                class="line-clamp-3 text-left text-sm/relaxed font-medium wrap-anywhere break-keep sm:text-base/relaxed"
                                v-html="useLineBreak(item.name)"
                            />
                        </NuxtLink>
                    </div>

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
                                    :src="item.shop.image ?? ''"
                                    :alt="item.shop.name"
                                    :width="20"
                                    :height="20"
                                    format="webp"
                                    fit="cover"
                                    class="size-5 rounded-md border border-zinc-300 dark:border-zinc-700"
                                />
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
                                        :src="item.shop.image || undefined"
                                        :alt="item.shop.name"
                                        :width="40"
                                        :height="40"
                                        format="webp"
                                        fit="cover"
                                        class="size-10 rounded-lg"
                                    />
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
    </div>
</template>
