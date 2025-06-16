<!-- eslint-disable vue/no-dupe-keys -->
<script lang="ts" setup>
const note = defineModel<string>('note', {
    required: true,
    default: '',
})
const unsupported = defineModel<boolean>('unsupported', {
    default: false,
})
const shapekeys = defineModel<Shapekey[]>('shapekeys', {
    default: [],
})

const emit = defineEmits(['remove', 'changeCategory'])

interface Props {
    size?: 'md' | 'lg'
    item: Item
}
const props = withDefaults(defineProps<Props>(), {
    size: 'md',
})

const modalRegisterShapekey = ref(false)

const booth_url = 'https://booth.pm/ja/items/'
</script>

<template>
    <div
        class="flex items-center overflow-clip rounded-lg ring-2 ring-zinc-300 dark:ring-zinc-700"
    >
        <div class="draggable h-full w-10 cursor-move p-1.5">
            <div
                class="flex size-full items-center justify-center rounded-lg transition duration-150 hover:bg-zinc-800"
            >
                <Icon
                    name="lucide:grip-vertical"
                    :size="22"
                    class="text-zinc-400"
                />
            </div>
        </div>

        <div class="flex w-full flex-col gap-2 py-2 pr-2">
            <div class="flex w-full items-start gap-3">
                <NuxtLink
                    :to="booth_url + props.item.id"
                    target="_blank"
                    class="shrink-0 select-none"
                >
                    <NuxtImg
                        :src="props.item.thumbnail"
                        :alt="props.item.name"
                        :data-size="props.size"
                        :data-nsfw="props.item.nsfw"
                        class="size-20 rounded-lg data-[nsfw=true]:blur-md"
                    />
                </NuxtLink>

                <div class="flex w-full flex-col items-start gap-3 self-center">
                    <div class="flex items-center gap-2">
                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="w-fit gap-2"
                        >
                            <p
                                class="line-clamp-2 w-fit break-before-all text-sm leading-normal font-medium text-black dark:text-white"
                            >
                                {{ lineBreak(props.item.name) }}
                            </p>
                        </NuxtLink>

                        <UTooltip
                            v-if="props.item.nsfw"
                            text="NSFW"
                            :delay-duration="0"
                        >
                            <Icon
                                name="lucide:heart"
                                size="18"
                                class="text-pink-400"
                            />
                        </UTooltip>
                    </div>

                    <div class="flex items-center gap-4">
                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="flex w-fit items-center gap-1.5"
                        >
                            <Icon
                                name="mingcute:currency-cny-fill"
                                :size="18"
                                class="shrink-0 text-zinc-600 dark:text-zinc-400"
                            />
                            <span
                                class="pt-px font-[Geist] text-xs leading-0 font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.price }}
                            </span>
                        </NuxtLink>

                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="flex w-fit items-center gap-1.5"
                        >
                            <Icon
                                name="mingcute:heart-fill"
                                :size="18"
                                class="shrink-0 text-zinc-600 dark:text-zinc-400"
                            />
                            <span
                                class="pt-px font-[Geist] text-xs leading-0 font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.likes?.toLocaleString() || '?' }}
                            </span>
                        </NuxtLink>

                        <NuxtLink
                            :to="`https://${props.item.shop.id}.booth.pm/`"
                            target="_blank"
                            class="flex w-fit items-center gap-1.5 pl-0.5"
                        >
                            <NuxtImg
                                :src="props.item.shop.thumbnail ?? ''"
                                :alt="props.item.shop.name"
                                :width="24"
                                :height="24"
                                fit="cover"
                                class="size-5 rounded-md p-px ring-1 ring-zinc-300 select-none dark:ring-zinc-600"
                            />
                            <span
                                class="line-clamp-1 text-xs leading-none font-semibold break-all text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.shop.name }}
                            </span>
                            <Icon
                                v-if="props.item.shop.verified"
                                name="lucide:check"
                                size="16"
                                class="size-3 shrink-0 text-zinc-700 dark:text-zinc-300"
                            />
                        </NuxtLink>
                    </div>
                </div>

                <div
                    class="flex flex-col items-end justify-between gap-1 self-stretch"
                >
                    <SetupsEditItemsItemMenu
                        v-model:unsupported="unsupported"
                        @change-category="emit('changeCategory', $event)"
                        @register-shapekey="modalRegisterShapekey = true"
                        @remove="emit('remove')"
                    />

                    <div class="flex items-center gap-3 px-2">
                        <UTooltip
                            v-if="unsupported"
                            text="アバター非対応"
                            :delay-duration="0"
                        >
                            <Icon
                                name="lucide:user-round-x"
                                size="16"
                                class="text-zinc-300"
                            />
                        </UTooltip>

                        <UTooltip
                            v-if="shapekeys.length"
                            :text="`${shapekeys.length}個のシェイプキー`"
                            :delay-duration="0"
                        >
                            <button
                                type="button"
                                class="flex cursor-pointer items-center gap-0.5 select-none"
                                @click="modalRegisterShapekey = true"
                            >
                                <Icon
                                    name="lucide:diamond"
                                    size="16"
                                    class="text-zinc-300"
                                />
                                <p
                                    class="pb-0.5 text-xs leading-none text-zinc-700 dark:text-zinc-300"
                                >
                                    {{ shapekeys.length }}
                                </p>
                            </button>
                        </UTooltip>
                    </div>
                </div>
            </div>

            <div class="flex w-full flex-col gap-2">
                <div
                    :data-exceeded="note.length > 140"
                    :class="[
                        'flex w-full items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800',
                        'ring-1 ring-zinc-300 ring-inset dark:ring-zinc-700',
                        'data-[exceeded=true]:ring-red-400 data-[exceeded=true]:dark:ring-red-400',
                    ]"
                >
                    <Icon
                        v-if="!note.length"
                        name="lucide:pen-line"
                        :size="18"
                        class="mt-[0.1rem] shrink-0 self-start text-zinc-400 dark:text-zinc-400"
                    />
                    <UiCount v-else :count="note.length" :max="140" />
                    <UiTextarea
                        v-model="note"
                        autoresize
                        placeholder="ノートを追加"
                        :rows="1"
                        unstyled
                        class="w-full"
                    />
                </div>
                <p
                    v-if="note.length > 140"
                    class="text-sm text-red-400 dark:text-red-400"
                >
                    {{ note.length }} / 140
                </p>
            </div>
        </div>

        <ModalRegisterShapekey
            v-model:visibility="modalRegisterShapekey"
            v-model:shapekeys="shapekeys"
        />
    </div>
</template>
