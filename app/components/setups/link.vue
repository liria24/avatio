<script lang="ts" setup>
interface Props {
    setup: ReturnType<typeof useSetupsList>['setups']['value'][number]
}
const { setup } = defineProps<Props>()

const { locale, t } = useI18n()

const avatarName = computed(() =>
    setup.items.length && setup.items[0]
        ? setup.items[0].niceName || avatarShortName(setup.items[0].name)
        : t('unknownAvatar'),
)

const firstImage = computed(() => setup.images?.[0])
const hasImages = computed(() => !!setup.images?.length)
const dominantColor = computed(() => firstImage.value?.themeColors?.[0] || '')
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="setup.id ? $localePath(`/setup/${setup.id}`) : undefined"
        :aria-label="setup.name"
        :data-has-images="hasImages"
        :class="
            cn(
                'group flex flex-col gap-1.5 overflow-clip rounded-lg p-1.5 shadow-black/10 transition delay-0 duration-100 ease-in-out hover:shadow-xl hover:ring-2 focus:ring-2 focus:outline-none focus-visible:shadow-xl dark:shadow-white/10',
                dominantColor
                    ? 'link-with-color'
                    : 'hover:ring-accented hover:bg-elevated focus:ring-accented focus:bg-elevated',
            )
        "
        :style="dominantColor ? { '--dominant-color': dominantColor } : undefined"
    >
        <div v-if="hasImages" class="relative aspect-video max-h-105 w-full">
            <NuxtImg
                :src="firstImage!.url"
                :alt="setup.name"
                width="360"
                format="avif"
                fit="cover"
                preload
                class="size-full rounded-lg object-cover"
            />
            <div
                :class="[
                    'gradient-overlay',
                    'absolute inset-0 rounded-lg p-2',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100 group-hover:delay-0 group-focus:delay-0',
                    'transition duration-100 ease-in-out',
                ]"
            >
                <span
                    class="md:text-md line-clamp-2 translate-y-4 text-sm font-medium break-all text-white opacity-0 duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                >
                    {{ setup.name }}
                </span>

                <div
                    class="flex translate-y-4 items-center gap-1 opacity-0 duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                >
                    <Icon name="mingcute:baby-fill" size="15" class="shrink-0 text-zinc-300" />
                    <span
                        class="line-clamp-1 overflow-visible text-xs leading-none break-all text-zinc-300"
                    >
                        {{ avatarName }}
                    </span>
                </div>
            </div>
        </div>

        <div class="flex w-full items-center gap-2">
            <UTooltip v-if="!hasImages" :text="avatarName" :delay-duration="100">
                <NuxtImg
                    v-if="setup.items[0]"
                    :src="setup.items[0].image || undefined"
                    alt=""
                    :width="88"
                    :height="88"
                    format="avif"
                    preload
                    class="aspect-square size-14 shrink-0 rounded-lg object-cover md:size-20"
                />
                <div
                    v-else
                    class="text-muted bg-muted group-hover:bg-default flex size-14 shrink-0 items-center justify-center rounded-lg transition-colors duration-100 md:size-20"
                >
                    <Icon name="mingcute:question-fill" size="32" class="text-dimmed" />
                </div>
            </UTooltip>

            <div class="flex w-full flex-col items-start justify-center gap-2 pl-0.5">
                <span
                    class="md:text-md text-toned sentence line-clamp-2 hidden text-sm font-medium group-data-[has-images=false]:inline"
                >
                    {{ setup.name }}
                </span>

                <div class="flex items-center gap-2">
                    <PopoverUser :user="setup.user">
                        <UAvatar
                            :src="setup.user.image || undefined"
                            :alt="setup.user.name"
                            icon="mingcute:user-3-fill"
                            aria-hidden="true"
                            size="2xs"
                        />
                    </PopoverUser>

                    <UTooltip :delay-duration="0">
                        <NuxtTime
                            :datetime="setup.createdAt"
                            relative
                            :locale
                            class="text-muted text-xs whitespace-nowrap"
                        />

                        <template #content>
                            <NuxtTime
                                :datetime="setup.createdAt"
                                date-style="medium"
                                time-style="short"
                                :locale
                            />
                        </template>
                    </UTooltip>
                </div>
            </div>
        </div>
    </NuxtLink>
</template>

<style scoped>
.link-with-color {
    --adjusted-color: color-mix(in oklch, var(--dominant-color), oklch(0.45 0 0) 40%);
    --ring-color: var(--adjusted-color);
    --bg-color: color-mix(in oklch, var(--adjusted-color), transparent 80%);
    --gradient-color: color-mix(in oklch, var(--adjusted-color), black 80%);
}

/* ダークモード */
@media (prefers-color-scheme: dark) {
    .link-with-color {
        --adjusted-color: color-mix(in oklch, var(--dominant-color), oklch(0.65 0 0) 40%);
    }
}

:global(.dark) .link-with-color {
    --adjusted-color: color-mix(in oklch, var(--dominant-color), oklch(0.65 0 0) 40%);
}

.link-with-color:hover,
.link-with-color:focus {
    box-shadow: 0 0 0 2px var(--ring-color);
    background-color: var(--bg-color);
}

.gradient-overlay {
    background-image: linear-gradient(
        to top,
        var(--gradient-color, rgba(0, 0, 0, 0.8)) 0%,
        transparent 80%
    );
}
</style>
