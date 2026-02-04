<script lang="ts" setup>
interface Props {
    setup: SerializedSetup
    class?: string | string[] | null
}
const props = defineProps<Props>()
const emit = defineEmits(['click'])
const colorMode = useColorMode()

// アバター情報の取得
const firstAvatar = computed(() => props.setup.items.find((item) => item.category === 'avatar'))

const avatarName = computed(() => {
    const avatar = firstAvatar.value
    if (!avatar) return '不明なベースアバター'
    return avatar.niceName || avatarShortName(avatar.name)
})

// 画像関連の処理
const firstImage = computed(() => props.setup.images?.[0])
const hasImages = computed(() => !!props.setup.images?.length)

// 画像サイズの計算（幅360px以下に制限、アスペクト比維持）
const imageSize = computed(() => {
    const image = firstImage.value
    if (!image) return { width: 0, height: 0 }

    const maxWidth = 360
    const { width, height } = image

    if (width <= maxWidth) return { width, height }

    const aspectRatio = height / width
    return {
        width: maxWidth,
        height: Math.round(maxWidth * aspectRatio),
    }
})

// placeholderサイズ（imageSizeの10分の1程度、整数値）
const placeholderSize = computed(() => {
    const { width, height } = imageSize.value
    return { width: Math.round(width / 10), height: Math.round(height / 10) }
})

// テーマカラー関連
const dominantColor = ref('')
const adjustedColor = ref('')

// カラー調整のヘルパー関数
const adjustColorForTheme = (hex: string, isDark: boolean): string => {
    if (!hex) return ''

    const luminance = getLuminance(hex)
    const { r, g, b } = hexToRgb(hex)

    const targetLuminance = isDark
        ? Math.max(0.4, Math.min(0.65, luminance))
        : Math.max(0.25, Math.min(0.6, luminance))

    const factor = targetLuminance / (luminance || 0.1)

    const clamp = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value * factor))

    return isDark
        ? rgbToHex(clamp(r, 30, 255), clamp(g, 30, 255), clamp(b, 30, 255))
        : rgbToHex(clamp(r, 20, 220), clamp(g, 20, 220), clamp(b, 20, 220))
}

// テーマカラーの初期化
const initializeThemeColor = () => {
    const themeColors = firstImage.value?.themeColors

    if (!themeColors?.length) {
        dominantColor.value = ''
        adjustedColor.value = ''
        return
    }

    const themeColor = themeColors[0]
    if (!themeColor) {
        dominantColor.value = ''
        adjustedColor.value = ''
        return
    }

    dominantColor.value = themeColor
    adjustedColor.value = adjustColorForTheme(themeColor, colorMode.value === 'dark')
}

// グラデーション色の計算
const gradientColor = computed(() => {
    if (!adjustedColor.value) return 'rgba(0,0,0,0.8)'

    const { r, g, b } = hexToRgb(adjustedColor.value)
    const darkeningFactor = 0.2

    return `rgba(${Math.round(r * darkeningFactor)}, ${Math.round(g * darkeningFactor)}, ${Math.round(b * darkeningFactor)}, 0.8)`
})

// CSS 変数のスタイル
const elementStyle = computed(() =>
    adjustedColor.value
        ? {
              '--dominant-color': adjustedColor.value,
              '--gradient-color': gradientColor.value,
          }
        : {}
)

// グラデーションスタイル
const gradientStyle = computed(() => {
    const gradient = adjustedColor.value ? 'var(--gradient-color)' : 'rgba(0,0,0,0.8)'

    return `background-image: linear-gradient(to top, ${gradient} 0%, transparent 80%)`
})

// リンクのクラス
const linkClasses = computed(() => {
    const baseClasses =
        'group flex flex-col rounded-lg overflow-clip focus:outline-none hover:ring-2 focus:ring-2 hover:shadow-xl focus-visible:shadow-xl shadow-black/10 dark:shadow-white/10 transition duration-100 ease-in-out'

    const colorClasses = adjustedColor.value
        ? 'hover:ring-[var(--dominant-color)] hover:bg-[var(--dominant-color)]/20 focus:ring-[var(--dominant-color)] focus:bg-[var(--dominant-color)]/20'
        : 'hover:ring-accented hover:bg-elevated focus:ring-accented focus:bg-elevated'

    return cn(baseClasses, colorClasses, props.class)
})

// ライフサイクル
onMounted(initializeThemeColor)

// テーマ変更の監視
watch(colorMode, (newMode) => {
    if (dominantColor.value)
        adjustedColor.value = adjustColorForTheme(
            dominantColor.value,
            newMode.preference === 'dark' ||
                (newMode.preference === 'system' && newMode.value === 'dark')
        )
})
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="setup.id ? $localePath(`/setup/${setup.id}`) : undefined"
        :class="linkClasses"
        :style="elementStyle"
        @click="emit('click')"
    >
        <!-- 画像がある場合のレイアウト -->
        <div v-if="hasImages" class="relative w-full p-1.5">
            <NuxtImg
                :src="firstImage!.url"
                :alt="setup.name"
                :width="imageSize.width"
                :height="imageSize.height"
                :placeholder="[placeholderSize.width, placeholderSize.height, 50, 5]"
                format="avif"
                fit="cover"
                preload
                class="size-full max-h-105 rounded-lg object-cover"
            />
            <div
                :class="[
                    'group absolute inset-1.5 rounded-lg p-2',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100',
                    'transition duration-100 ease-in-out',
                ]"
                :style="gradientStyle"
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

        <!-- フッター部分（共通） -->
        <div class="flex w-full items-center">
            <!-- 画像がない場合のアバター表示 -->
            <NuxtImg
                v-if="!hasImages && firstAvatar"
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="firstAvatar.image || undefined"
                :width="88"
                :height="88"
                format="avif"
                custom
            >
                <UTooltip v-if="isLoaded" :text="avatarName" :delay-duration="100">
                    <img
                        v-bind="imgAttrs"
                        :src
                        alt=""
                        loading="lazy"
                        fetchpriority="low"
                        class="m-1 aspect-square size-14 shrink-0 rounded-lg object-cover md:size-20"
                    />
                </UTooltip>

                <USkeleton
                    v-else
                    class="my-1.5 ml-1.5 aspect-square h-14 shrink-0 rounded-lg md:h-20"
                />
            </NuxtImg>

            <!-- アバターがない場合のプレースホルダー -->
            <div
                v-else-if="!firstAvatar && !hasImages"
                class="text-muted bg-accented my-1.5 ml-1.5 flex size-14 shrink-0 items-center justify-center rounded-lg"
            >
                ?
            </div>

            <!-- 画像がある場合のメタ情報 -->
            <div v-if="hasImages" class="flex w-full items-center justify-end gap-2 px-2 pb-2">
                <UTooltip :delay-duration="0">
                    <NuxtTime
                        :datetime="setup.createdAt"
                        relative
                        class="text-muted text-xs whitespace-nowrap"
                    />

                    <template #content>
                        <NuxtTime
                            :datetime="setup.createdAt"
                            date-style="medium"
                            time-style="short"
                        />
                    </template>
                </UTooltip>

                <UPopover mode="hover">
                    <UAvatar
                        :src="setup.user.image || undefined"
                        :alt="setup.user.name"
                        icon="mingcute:user-3-fill"
                        aria-hidden="true"
                        size="2xs"
                    />

                    <template #content>
                        <NuxtLink :to="`/@${setup.user.username}`" class="flex py-2 pr-3 pl-2">
                            <UUser
                                :avatar="{
                                    src: setup.user.image || undefined,
                                    icon: 'mingcute:user-3-fill',
                                }"
                                :description="`@${setup.user.username}`"
                                :ui="{
                                    name: 'flex gap-1 items-center',
                                    description: 'line-clamp-1 break-all wrap-anywhere font-mono',
                                }"
                            >
                                <template #name>
                                    <span>{{ setup.user.name }}</span>
                                    <UserBadges
                                        v-if="setup.user.badges?.length"
                                        :badges="setup.user.badges"
                                        size="sm"
                                    />
                                </template>
                            </UUser>
                        </NuxtLink>
                    </template>
                </UPopover>
            </div>

            <!-- 画像がない場合のメタ情報 -->
            <div v-else class="flex w-full flex-col items-start justify-center gap-2 pr-2 pl-3">
                <span class="md:text-md text-toned sentence line-clamp-2 text-sm font-medium">
                    {{ props.setup.name }}
                </span>

                <div class="flex items-center gap-2">
                    <UPopover mode="hover">
                        <UAvatar
                            :src="setup.user.image || undefined"
                            :alt="setup.user.name"
                            icon="mingcute:user-3-fill"
                            aria-hidden="true"
                            size="2xs"
                        />

                        <template #content>
                            <NuxtLink :to="`/@${setup.user.username}`" class="flex py-2 pr-3 pl-2">
                                <UUser
                                    :avatar="{
                                        src: setup.user.image || undefined,
                                        icon: 'mingcute:user-3-fill',
                                    }"
                                    :description="`@${setup.user.username}`"
                                    :ui="{
                                        name: 'flex gap-1 items-center',
                                        description:
                                            'line-clamp-1 break-all wrap-anywhere font-mono',
                                    }"
                                >
                                    <template #name>
                                        <span>{{ setup.user.name }}</span>
                                        <UserBadges
                                            v-if="setup.user.badges?.length"
                                            :badges="setup.user.badges"
                                            size="sm"
                                        />
                                    </template>
                                </UUser>
                            </NuxtLink>
                        </template>
                    </UPopover>

                    <UTooltip :delay-duration="0">
                        <NuxtTime
                            :datetime="setup.createdAt"
                            relative
                            class="text-muted text-xs whitespace-nowrap"
                        />

                        <template #content>
                            <NuxtTime
                                :datetime="setup.createdAt"
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
