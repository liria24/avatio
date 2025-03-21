<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

type OptionalKeys = 'note' | 'unsupported';
interface Props {
    size?: 'lg' | 'md';
    noAction?: boolean;
    item: Partial<Pick<SetupItem, OptionalKeys>> &
        Omit<SetupItem, OptionalKeys>;
    class?: string | string[];
}
const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    noAction: false,
});

const loading = ref(false);

const sourceInfo = {
    booth: {
        id: 'booth',
        generateUrl: (id: number) => `https://booth.pm/ja/items/${id}`,
    },
};

const url = sourceInfo.booth.generateUrl(props.item.id);
const item = ref<SetupItem>({
    ...props.item,
    note: props.item.note ?? '',
    unsupported: props.item.unsupported ?? false,
});

onMounted(async () => {
    const timeDifference =
        new Date().getTime() - new Date(props.item.updated_at).getTime();

    // 時間の差分が1日を超えている場合、処理継続する
    if (timeDifference > 24 * 60 * 60 * 1000) {
        const response = await $fetch('/api/item/booth', {
            query: { id: props.item.id },
        });

        if (response.data)
            item.value = {
                ...response.data,
                note: '',
                unsupported: false,
            };
        if (!response.data) item.value.outdated = true;
    }

    loading.value = false;
});
</script>

<template>
    <div
        v-if="loading"
        :class="
            twMerge(
                'flex items-center px-6 ring-1 ring-zinc-300 dark:ring-zinc-600 rounded-lg overflow-clip',
                props.class
            )
        "
    >
        <Icon
            name="svg-spinners:ring-resize"
            size="24"
            :class="props.size === 'lg' ? 'h-20 sm:h-32' : 'h-20'"
        />
    </div>

    <div
        v-else
        :class="
            twMerge(
                'p-1.5 flex flex-col gap-1.5 ring-1 ring-zinc-300 dark:ring-zinc-600 rounded-lg overflow-clip',
                props.class
            )
        "
    >
        <div class="flex items-stretch gap-2">
            <NuxtLink
                :to="url"
                target="_blank"
                :data-size="props.size"
                :class="[
                    'shrink-0 rounded-lg object-cover select-none overflow-hidden flex items-center',
                ]"
            >
                <NuxtImg
                    preload
                    :src="item.thumbnail"
                    :alt="item.name"
                    format="webp"
                    fit="cover"
                    quality="70"
                    :sizes="props.size === 'lg' ? '128px' : '80px'"
                    :width="props.size === 'lg' ? 128 : 80"
                    :height="props.size === 'lg' ? 128 : 80"
                    :data-size="props.size"
                    :data-nsfw="item.nsfw"
                    class="object-cover rounded-lg text-xs size-20 data-[size=lg]:sm:size-32 data-[nsfw=true]:blur-md"
                />
            </NuxtLink>

            <div class="w-full self-stretch gap-1 justify-between flex">
                <div class="grow self-center py-1.5 flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <UiTooltip v-if="item.nsfw" text="NSFW">
                            <Icon
                                name="lucide:heart"
                                :size="18"
                                class="text-pink-400"
                            />
                        </UiTooltip>
                        <NuxtLink :to="url" target="_blank" class="w-fit gap-2">
                            <p
                                :class="[
                                    'font-medium text-sm/relaxed sm:text-base/relaxed text-left text-zinc-900 dark:text-zinc-100',
                                    'line-clamp-3 break-keep [overflow-wrap:anywhere]',
                                ]"
                            >
                                {{ useSentence(item.name) }}
                            </p>
                        </NuxtLink>
                    </div>

                    <SetupsItemInfo
                        :url="url"
                        :likes="item.likes"
                        :price="item.price"
                        :shop="item.shop"
                        class="hidden sm:flex"
                    />
                </div>

                <Button
                    v-if="!props.noAction"
                    :to="{ name: 'search', query: { item: props.item.id } }"
                    icon="lucide:search"
                    tooltip="このアイテムを含むセットアップを検索"
                    aria-label="このアイテムを含むセットアップを検索"
                    variant="flat"
                    class="self-start p-1.5 sm:p-2"
                />
            </div>
        </div>

        <SetupsItemInfo
            :url="url"
            :likes="item.likes"
            :price="item.price"
            :shop="item.shop"
            class="static sm:hidden"
        />

        <SetupsItemAttributes
            :note="item.note"
            :unsupported="item.unsupported"
        />
    </div>
</template>
