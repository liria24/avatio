<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

interface Props {
    noUser?: boolean;
    setup: SetupClient;
    class?: string;
}
const props = defineProps<Props>();

const emit = defineEmits(['click']);

const date = new Date(props.setup.created_at);
const dateLocale = date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="{ name: 'setup-id', params: { id: props.setup.id } }"
        :class="
            twMerge(
                'group flex flex-col rounded-lg overflow-clip',
                'hover:ring-2 hover:ring-zinc-400',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                'hover:shadow-xl shadow-black/10 dark:shadow-white/10',
                'transition duration-50 ease-in-out',
                props.class
            )
        "
        @click="emit('click')"
    >
        <div
            v-if="props.setup.images.length && props.setup.images[0]"
            class="relative w-full p-1.5"
        >
            <NuxtImg
                :src="
                    useGetImage(props.setup.images[0].name, { prefix: 'setup' })
                "
                :alt="props.setup.name"
                preset="thumbnail"
                format="webp"
                :width="props.setup.images[0].width ?? 640"
                :height="props.setup.images[0].height ?? 360"
                :placeholder="[
                    props.setup.images[0].width ?? 192,
                    props.setup.images[0].height ?? 108,
                    75,
                    5,
                ]"
                class="size-full max-h-[420px] rounded-lg object-cover"
            />
            <div
                :class="[
                    'absolute inset-1.5 p-2 rounded-lg',
                    'flex flex-col items-start justify-end gap-1',
                    'bg-gradient-to-t from-black/60 to-transparent',
                    'opacity-0 group-hover:opacity-100',
                    'transition duration-100 ease-in-out',
                ]"
            >
                <span
                    class="text-sm md:text-md font-medium text-white dark:text-white break-all line-clamp-2"
                >
                    {{ props.setup.name }}
                </span>

                <div class="flex items-center gap-1">
                    <Icon
                        name="lucide:person-standing"
                        size="15"
                        class="shrink-0 text-zinc-300 dark:text-zinc-300"
                    />
                    <span
                        class="text-xs text-zinc-300 dark:text-zinc-300 break-all line-clamp-1 leading-none"
                    >
                        {{
                            props.setup.items.avatar?.length &&
                            !props.setup.items.avatar[0]!.outdated
                                ? useAvatarName(
                                      props.setup.items.avatar[0]!.name
                                  )
                                : '不明なベースアバター'
                        }}
                    </span>
                </div>
            </div>
        </div>

        <div class="w-full flex items-center">
            <NuxtImg
                v-if="
                    !props.setup.images.length &&
                    props.setup.items.avatar?.length &&
                    !props.setup.items.avatar[0]!.outdated
                "
                :src="props.setup.items.avatar[0]!.thumbnail"
                :alt="props.setup.name"
                preset="avatarThumbnail"
                :placeholder="[30, 30, 75, 5]"
                class="h-14 md:h-20 my-1.5 ml-1.5 rounded-lg overflow-clip shrink-0 object-cover"
            />

            <div
                v-else-if="
                    (!props.setup.items.avatar?.length ||
                        props.setup.items.avatar[0]!.outdated) &&
                    !props.setup.images?.length
                "
                class="size-14 my-1.5 ml-1.5 rounded-lg flex shrink-0 items-center justify-center text-zinc-400 bg-zinc-300 dark:bg-zinc-600"
            >
                ?
            </div>

            <div
                v-if="!props.setup.images.length"
                class="w-full pb-2 pr-2 pl-3 flex flex-col items-start justify-center gap-1"
            >
                <span
                    class="text-sm md:text-md font-medium text-zinc-700 dark:text-zinc-200 break-keep line-clamp-2"
                >
                    {{ useSentence(props.setup.name) }}
                </span>

                <div class="flex items-center gap-1">
                    <Icon
                        name="lucide:person-standing"
                        size="15"
                        class="shrink-0 text-zinc-500 dark:text-zinc-400"
                    />
                    <span
                        class="text-xs text-zinc-500 dark:text-zinc-400 break-all line-clamp-1 leading-none"
                    >
                        {{
                            props.setup.items.avatar?.length &&
                            !props.setup.items.avatar[0]!.outdated
                                ? useAvatarName(
                                      props.setup.items.avatar[0]!.name
                                  )
                                : '不明なベースアバター'
                        }}
                    </span>
                </div>

                <div class="flex items-center gap-2">
                    <HovercardUser v-if="!noUser" :user="props.setup.author">
                        <UiAvatar
                            :url="
                                props.setup.author.avatar
                                    ? useGetImage(props.setup.author.avatar, {
                                          prefix: 'avatar',
                                      })
                                    : ''
                            "
                            :alt="props.setup.author.name ?? ''"
                            aria-hidden="true"
                            :icon-size="12"
                            class="size-5"
                        />
                    </HovercardUser>
                    <UiTooltip :text="dateLocale">
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
                        >
                            {{ useDateElapsed(date) }}
                        </p>
                    </UiTooltip>
                </div>
            </div>

            <div
                v-else
                class="w-full pb-2 px-2 flex items-center justify-end gap-2"
            >
                <UiTooltip :text="dateLocale">
                    <p
                        class="text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
                    >
                        {{ useDateElapsed(date) }}
                    </p>
                </UiTooltip>
                <HovercardUser v-if="!noUser" :user="props.setup.author">
                    <UiAvatar
                        :url="
                            props.setup.author.avatar
                                ? useGetImage(props.setup.author.avatar, {
                                      prefix: 'avatar',
                                  })
                                : ''
                        "
                        :alt="props.setup.author.name ?? ''"
                        aria-hidden="true"
                        :icon-size="12"
                        class="size-5"
                    />
                </HovercardUser>
            </div>
        </div>
    </NuxtLink>
</template>
