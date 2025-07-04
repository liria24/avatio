<script lang="ts" setup>
interface Props {
    noUser?: boolean
    setup: Setup
    class?: string | string[] | null
}
const props = defineProps<Props>()
const emit = defineEmits(['click'])
const colorMode = useColorMode()

const date = new Date(props.setup.createdAt)
const dateLocale = computed(() => {
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
})

const firstAvatar = computed(() =>
    props.setup.items.find((item) => item.category === 'avatar')
)

const avatarName = computed(() => {
    if (!firstAvatar.value) return '不明なベースアバター'
    return avatarShortName(firstAvatar.value.name)
})

const dominantColor = ref('')
const adjustedColor = ref('')

const adjustColorForTheme = (hex: string, isDark: boolean) => {
    if (!hex) return ''

    const luminance = getLuminance(hex)
    const { r, g, b } = hexToRgb(hex)

    // ダークモード
    if (isDark) {
        // 明るさの下限と上限を設定
        const targetLuminance = Math.max(0.4, Math.min(0.65, luminance))
        const factor = targetLuminance / (luminance || 0.1)

        return rgbToHex(
            Math.min(255, Math.max(30, r * factor)),
            Math.min(255, Math.max(30, g * factor)),
            Math.min(255, Math.max(30, b * factor))
        )
    }
    // ライトモード
    else {
        // 暗さの下限と上限を設定
        const targetLuminance = Math.max(0.25, Math.min(0.6, luminance))
        const factor = targetLuminance / (luminance || 0.1)

        return rgbToHex(
            Math.min(220, Math.max(20, r * factor)),
            Math.min(220, Math.max(20, g * factor)),
            Math.min(220, Math.max(20, b * factor))
        )
    }
}

const extractImageColor = async (event: Event) => {
    const target = event.target as HTMLImageElement
    if (!target || !(target instanceof HTMLImageElement)) return

    try {
        const { extractColors } = await import('extract-colors')

        // 画像から色を抽出
        const colors = await extractColors(target, {
            pixels: 1000,
            distance: 0.2,
            saturationDistance: 0.2,
            lightnessDistance: 0.5,
        })

        if (colors?.length > 0 && colors[0]) {
            const extractedColor = colors[0].hex || ''
            dominantColor.value = extractedColor

            const isDark = colorMode.value === 'dark'
            adjustedColor.value = adjustColorForTheme(extractedColor, isDark)
        }
    } catch (error) {
        console.error('色の抽出に失敗しました:', error)
        dominantColor.value = ''
        adjustedColor.value = ''
    }
}

// テーマ変更時に色を再調整するウォッチャー
watch(
    () => colorMode.value,
    (newMode) => {
        if (dominantColor.value) {
            const isDark = newMode === 'dark'
            adjustedColor.value = adjustColorForTheme(
                dominantColor.value,
                isDark
            )
        }
    }
)

const gradientColor = computed(() => {
    if (!adjustedColor.value) return 'rgba(0,0,0,0.6)'

    const { r, g, b } = hexToRgb(adjustedColor.value)
    const darkeningFactor = 0.2
    return `rgba(${Math.round(r * darkeningFactor)}, ${Math.round(g * darkeningFactor)}, ${Math.round(b * darkeningFactor)}, 0.5)`
})

const elementStyle = computed(() => {
    if (!adjustedColor.value) return {}
    return {
        '--dominant-color': adjustedColor.value,
        '--gradient-color': gradientColor.value,
    }
})

const gradientStyle = computed(() => {
    if (!adjustedColor.value)
        return 'background-image: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)'
    return `background-image: linear-gradient(to top, var(--gradient-color) 0%, transparent 60%)`
})

const linkClasses = computed(() => {
    return cn(
        'group flex flex-col rounded-lg overflow-clip focus:outline-none hover:ring-2 focus:ring-2',
        adjustedColor.value
            ? 'hover:ring-[var(--dominant-color)] hover:bg-[var(--dominant-color)]/20 focus:ring-[var(--dominant-color)] focus:bg-[var(--dominant-color)]/20'
            : 'hover:ring-accented hover:bg-elevated focus:ring-accented focus:bg-elevated',
        'hover:shadow-xl focus-visible:shadow-xl shadow-black/10 dark:shadow-white/10',
        'transition duration-100 ease-in-out',
        props.class
    )
})
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="$localePath(`/setup/${props.setup.id}`)"
        :class="linkClasses"
        :style="elementStyle"
        @click="emit('click')"
    >
        <div v-if="props.setup.images?.length" class="relative w-full p-1.5">
            <NuxtImg
                :src="props.setup.images[0]?.url"
                :alt="setup.name"
                :width="props.setup.images[0]?.width ?? 640"
                :height="props.setup.images[0]?.height ?? 360"
                :placeholder="[
                    props.setup.images[0]?.width ?? 192,
                    props.setup.images[0]?.height ?? 108,
                    75,
                    5,
                ]"
                loading="lazy"
                format="webp"
                fit="cover"
                class="size-full max-h-[420px] rounded-lg object-cover"
                @load="extractImageColor"
            />
            <div
                :class="[
                    'absolute inset-1.5 rounded-lg p-2',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100',
                    'transition duration-100 ease-in-out',
                ]"
                :style="gradientStyle"
            >
                <span
                    class="md:text-md line-clamp-2 text-sm font-medium break-all text-white"
                >
                    {{ setup.name }}
                </span>

                <div class="flex items-center gap-1">
                    <Icon
                        name="lucide:person-standing"
                        size="15"
                        class="shrink-0 text-zinc-300"
                    />
                    <span
                        class="line-clamp-1 text-xs leading-none break-all text-zinc-300"
                    >
                        {{ avatarName }}
                    </span>
                </div>
            </div>
        </div>

        <div class="flex w-full items-center">
            <UTooltip
                v-if="!props.setup.images?.length && firstAvatar"
                :text="avatarName"
                :delay-duration="0"
            >
                <NuxtImg
                    v-slot="{ isLoaded, src, imgAttrs }"
                    :src="firstAvatar.image || undefined"
                    :alt="firstAvatar.name"
                    :width="80"
                    :height="80"
                    format="webp"
                    loading="lazy"
                    class="m-1 aspect-square size-14 shrink-0 rounded-lg object-cover md:size-20"
                >
                    <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                    <USkeleton
                        v-else
                        class="my-1.5 ml-1.5 aspect-square h-14 shrink-0 rounded-lg md:h-20"
                    />
                </NuxtImg>
            </UTooltip>

            <div
                v-else-if="!firstAvatar && !props.setup.images?.length"
                class="text-muted my-1.5 ml-1.5 flex size-14 shrink-0 items-center justify-center rounded-lg bg-zinc-300"
            >
                ?
            </div>

            <div
                v-if="!props.setup.images?.length"
                class="flex w-full flex-col items-start justify-center gap-2 pr-2 pl-3"
            >
                <span
                    class="md:text-md text-toned line-clamp-2 text-sm font-medium break-keep"
                    v-html="useLineBreak(setup.name)"
                />

                <div class="flex items-center gap-2">
                    <UPopover v-if="!props.noUser" mode="hover">
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

                    <UTooltip :text="dateLocale" :delay-duration="0">
                        <NuxtTime
                            :datetime="date"
                            relative
                            class="text-muted text-xs whitespace-nowrap"
                        />
                    </UTooltip>
                </div>
            </div>

            <div
                v-else
                class="flex w-full items-center justify-end gap-2 px-2 pb-2"
            >
                <UTooltip :text="dateLocale" :delay-duration="0">
                    <NuxtTime
                        :datetime="date"
                        relative
                        class="text-muted text-xs whitespace-nowrap"
                    />
                </UTooltip>

                <UPopover v-if="!props.noUser" mode="hover">
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
        </div>
    </NuxtLink>
</template>
