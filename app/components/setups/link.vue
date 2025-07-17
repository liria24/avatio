<script lang="ts" setup>
interface Props {
    setup: Setup
    class?: string | string[] | null
}
const props = defineProps<Props>()
const emit = defineEmits(['click'])

const firstAvatar = props.setup.items.find((item) => item.category === 'avatar')

const avatarName = (() => {
    if (!firstAvatar) return '不明なベースアバター'
    if (firstAvatar.niceName?.length) return firstAvatar.niceName
    return avatarShortName(firstAvatar.name)
})()

const setupNameHtml = useLineBreak(props.setup.name)

const hasImages = !!props.setup.images?.length
const firstImage = props.setup.images?.[0]
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="$localePath(`/setup/${props.setup.id}`)"
        :class="
            cn(
                'group hover:ring-accented hover:bg-elevated focus:ring-accented focus:bg-elevated flex flex-col overflow-clip rounded-lg shadow-black/10 transition duration-100 ease-in-out hover:shadow-xl hover:ring-2 focus:ring-2 focus:outline-none focus-visible:shadow-xl dark:shadow-white/10',
                props.class
            )
        "
        @click="emit('click')"
    >
        <div v-if="hasImages" class="relative w-full p-1.5">
            <NuxtImg
                :src="firstImage?.url"
                :alt="setup.name"
                :width="360"
                loading="lazy"
                format="webp"
                fit="cover"
                class="size-full max-h-[420px] rounded-lg object-cover"
            />
            <div
                :class="[
                    'group absolute inset-1.5 rounded-lg p-2',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100',
                    'transition duration-100 ease-in-out',
                    'bg-gradient-to-t from-black/80 to-transparent',
                ]"
            >
                <span
                    class="md:text-md line-clamp-2 translate-y-[1rem] text-sm font-medium break-all text-white opacity-0 duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                >
                    {{ setup.name }}
                </span>

                <div
                    class="flex translate-y-[1rem] items-center gap-1 opacity-0 duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                >
                    <Icon
                        name="lucide:person-standing"
                        size="15"
                        class="shrink-0 text-zinc-300"
                    />
                    <span
                        class="line-clamp-1 overflow-visible text-xs leading-none break-all text-zinc-300"
                    >
                        {{ avatarName }}
                    </span>
                </div>
            </div>
        </div>

        <div class="flex w-full items-center">
            <NuxtImg
                v-if="!hasImages && firstAvatar"
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="firstAvatar.image || undefined"
                :alt="firstAvatar.name"
                :width="80"
                :height="80"
                format="webp"
                loading="lazy"
                custom
                class="m-1 aspect-square size-14 shrink-0 rounded-lg object-cover md:size-20"
            >
                <UTooltip
                    v-if="isLoaded"
                    :text="avatarName"
                    :delay-duration="100"
                >
                    <img v-bind="imgAttrs" :src="src" />
                </UTooltip>

                <USkeleton
                    v-else
                    class="my-1.5 ml-1.5 aspect-square h-14 shrink-0 rounded-lg md:h-20"
                />
            </NuxtImg>
            <div
                v-else-if="!firstAvatar && !hasImages"
                class="text-muted my-1.5 ml-1.5 flex size-14 shrink-0 items-center justify-center rounded-lg bg-zinc-300"
            >
                ?
            </div>

            <div
                v-if="hasImages"
                class="flex w-full items-center justify-end gap-2 px-2 pb-2"
            >
                <UTooltip :delay-duration="0">
                    <NuxtTime
                        :datetime="props.setup.createdAt"
                        relative
                        class="text-muted text-xs whitespace-nowrap"
                    />

                    <template #content>
                        <NuxtTime
                            :datetime="props.setup.createdAt"
                            date-style="medium"
                            time-style="short"
                        />
                    </template>
                </UTooltip>

                <UPopover mode="hover">
                    <UAvatar
                        :src="setup.user.image || undefined"
                        :alt="setup.user.name"
                        icon="lucide:user-round"
                        aria-hidden="true"
                        size="2xs"
                    />

                    <template #content>
                        <NuxtLink
                            :to="`/@${props.setup.user.id}`"
                            class="flex items-center gap-3 py-2 pr-3 pl-2"
                        >
                            <UAvatar
                                :src="props.setup.user.image || undefined"
                                :alt="props.setup.user.name"
                                icon="lucide:user-round"
                                class="size-10"
                            />
                            <div class="flex flex-wrap gap-2">
                                <span
                                    class="text-toned text-sm leading-none font-semibold"
                                >
                                    {{ props.setup.user.name }}
                                </span>
                                <UserBadges
                                    v-if="props.setup.user.badges?.length"
                                    :badges="props.setup.user.badges"
                                    size="xs"
                                />
                            </div>
                        </NuxtLink>
                    </template>
                </UPopover>
            </div>
            <div
                v-else
                class="flex w-full flex-col items-start justify-center gap-2 pr-2 pl-3"
            >
                <span
                    class="md:text-md text-toned line-clamp-2 text-sm font-medium break-keep"
                    v-html="setupNameHtml"
                />

                <div class="flex items-center gap-2">
                    <UPopover mode="hover">
                        <UAvatar
                            :src="props.setup.user.image || undefined"
                            :alt="props.setup.user.name"
                            icon="lucide:user-round"
                            aria-hidden="true"
                            size="2xs"
                        />

                        <template #content>
                            <NuxtLink
                                :to="`/@${props.setup.user.id}`"
                                class="flex items-center gap-3 py-2 pr-3 pl-2"
                            >
                                <UAvatar
                                    :src="props.setup.user.image || undefined"
                                    :alt="props.setup.user.name"
                                    icon="lucide:user-round"
                                    class="size-10"
                                />
                                <div class="flex flex-wrap gap-2">
                                    <span
                                        class="text-toned text-sm leading-none font-semibold"
                                    >
                                        {{ props.setup.user.name }}
                                    </span>
                                    <UserBadges
                                        v-if="props.setup.user.badges?.length"
                                        :badges="props.setup.user.badges"
                                        size="xs"
                                    />
                                </div>
                            </NuxtLink>
                        </template>
                    </UPopover>

                    <UTooltip :delay-duration="0">
                        <NuxtTime
                            :datetime="props.setup.createdAt"
                            relative
                            class="text-muted text-xs whitespace-nowrap"
                        />

                        <template #content>
                            <NuxtTime
                                :datetime="props.setup.createdAt"
                                date-style="medium"
                                time-style="short"
                            />
                        </template>
                    </UTooltip>
                </div>
            </div>
        </div>
    </NuxtLink>
</template>
