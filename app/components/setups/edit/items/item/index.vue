<!-- eslint-disable vue/no-dupe-keys -->
<script lang="ts" setup>
const note = defineModel<string>('note', {
    required: true,
    default: '',
});
const unsupported = defineModel<boolean>('unsupported', {
    default: false,
});
const shapekeys = defineModel<Shapekey[]>('shapekeys', {
    default: [],
});

const emit = defineEmits(['remove', 'changeCategory']);

interface Props {
    size?: 'md' | 'lg';
    item: Item;
}
const props = withDefaults(defineProps<Props>(), {
    size: 'md',
});

const modalRegisterShapekey = ref(false);

const booth_url = 'https://booth.pm/ja/items/';
</script>

<template>
    <div
        class="flex items-center ring-2 ring-zinc-300 dark:ring-zinc-700 rounded-lg overflow-clip"
    >
        <div class="draggable cursor-move w-10 h-full p-1.5">
            <div
                class="size-full rounded-lg flex items-center justify-center hover:bg-zinc-800 transition duration-150"
            >
                <Icon
                    name="lucide:grip-vertical"
                    :size="22"
                    class="text-zinc-400"
                />
            </div>
        </div>

        <div class="w-full py-2 pr-2 flex flex-col gap-2">
            <div class="w-full flex gap-3 items-start">
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

                <div class="self-center w-full flex flex-col gap-3 items-start">
                    <div class="gap-2 flex items-center">
                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="w-fit gap-2"
                        >
                            <p
                                class="w-fit text-sm font-medium leading-normal break-before-all line-clamp-2 text-black dark:text-white"
                            >
                                {{ useSentence(props.item.name) }}
                            </p>
                        </NuxtLink>

                        <UiTooltip v-if="props.item.nsfw" text="NSFW">
                            <Icon
                                name="lucide:heart"
                                size="18"
                                class="text-pink-400"
                            />
                        </UiTooltip>
                    </div>

                    <div class="flex items-center gap-4">
                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="flex items-center gap-1.5 w-fit"
                        >
                            <Icon
                                name="mingcute:currency-cny-fill"
                                :size="18"
                                class="shrink-0 text-zinc-600 dark:text-zinc-400"
                            />
                            <span
                                class="pt-px text-xs font-[Geist] font-semibold leading-0 whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.price }}
                            </span>
                        </NuxtLink>

                        <NuxtLink
                            :to="booth_url + props.item.id"
                            target="_blank"
                            class="flex items-center gap-1.5 w-fit"
                        >
                            <Icon
                                name="mingcute:heart-fill"
                                :size="18"
                                class="shrink-0 text-zinc-600 dark:text-zinc-400"
                            />
                            <span
                                class="pt-px text-xs font-[Geist] font-semibold leading-0 whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.likes?.toLocaleString() || '?' }}
                            </span>
                        </NuxtLink>

                        <NuxtLink
                            :to="`https://${props.item.shop.id}.booth.pm/`"
                            target="_blank"
                            class="pl-0.5 flex items-center gap-1.5 w-fit"
                        >
                            <NuxtImg
                                :src="props.item.shop.thumbnail ?? ''"
                                :alt="props.item.shop.name"
                                :width="24"
                                :height="24"
                                fit="cover"
                                class="size-5 rounded-md p-px select-none ring-1 ring-zinc-300 dark:ring-zinc-600"
                            />
                            <span
                                class="text-xs font-semibold leading-none line-clamp-1 break-all text-zinc-600 dark:text-zinc-400"
                            >
                                {{ props.item.shop.name }}
                            </span>
                            <Icon
                                v-if="props.item.shop.verified"
                                name="lucide:check"
                                size="16"
                                class="shrink-0 size-3 text-zinc-700 dark:text-zinc-300"
                            />
                        </NuxtLink>
                    </div>
                </div>

                <div
                    class="self-stretch flex flex-col gap-1 items-end justify-between"
                >
                    <SetupsEditItemsItemMenu
                        v-model:unsupported="unsupported"
                        @change-category="emit('changeCategory', $event)"
                        @register-shapekey="modalRegisterShapekey = true"
                        @remove="emit('remove')"
                    />

                    <div class="px-2 flex items-center gap-3">
                        <UiTooltip v-if="unsupported" text="アバター非対応">
                            <Icon
                                name="lucide:user-round-x"
                                size="16"
                                class="text-zinc-300"
                            />
                        </UiTooltip>

                        <UiTooltip
                            v-if="shapekeys.length"
                            :text="`${shapekeys.length}個のシェイプキー`"
                        >
                            <button
                                type="button"
                                class="flex items-center gap-0.5 select-none cursor-pointer"
                                @click="modalRegisterShapekey = true"
                            >
                                <Icon
                                    name="lucide:diamond"
                                    size="16"
                                    class="text-zinc-300"
                                />
                                <p
                                    class="pb-0.5 text-xs text-zinc-700 dark:text-zinc-300 leading-none"
                                >
                                    {{ shapekeys.length }}
                                </p>
                            </button>
                        </UiTooltip>
                    </div>
                </div>
            </div>

            <div class="w-full flex flex-col gap-2">
                <div
                    :data-exceeded="note.length > 140"
                    :class="[
                        'w-full px-3 py-2 gap-2 flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800',
                        'ring-inset ring-1 ring-zinc-300 dark:ring-zinc-700',
                        'data-[exceeded=true]:ring-red-400 data-[exceeded=true]:dark:ring-red-400',
                    ]"
                >
                    <Icon
                        v-if="!note.length"
                        name="lucide:pen-line"
                        :size="18"
                        class="self-start shrink-0 mt-[0.1rem] text-zinc-400 dark:text-zinc-400"
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
