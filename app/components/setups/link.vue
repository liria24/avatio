<script lang="ts" setup>
interface Props {
    setup: Serialized<Setup>
    class?: string | string[] | null
}
const { setup, class: className } = defineProps<Props>()

const emit = defineEmits(['click'])

const { locale, t } = useI18n()

const dominantColor = ref('')

// アバター情報の取得
const firstAvatar = computed(() => setup.items.find((item) => item.category === 'avatar'))

const avatarName = computed(() => {
    const avatar = firstAvatar.value
    if (!avatar) return t('unknownAvatar')
    return avatar.niceName || avatarShortName(avatar.name)
})

// 画像関連の処理
const firstImage = computed(() => setup.images?.[0])
const hasImages = computed(() => !!setup.images?.length)

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

// テーマカラーの初期化
const initializeThemeColor = () => {
    const themeColors = firstImage.value?.themeColors
    dominantColor.value = themeColors?.[0] || ''
}

initializeThemeColor()
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="setup.id ? $localePath(`/setup/${setup.id}`) : undefined"
        :class="
            cn(
                'group flex flex-col overflow-clip rounded-lg shadow-black/10 transition duration-100 ease-in-out hover:shadow-xl hover:ring-2 focus:ring-2 focus:outline-none focus-visible:shadow-xl dark:shadow-white/10',
                dominantColor
                    ? 'link-with-color'
                    : 'hover:ring-accented hover:bg-elevated focus:ring-accented focus:bg-elevated',
                className,
            )
        "
        :style="dominantColor ? { '--dominant-color': dominantColor } : undefined"
        @click="emit('click')"
    >
        <!-- 画像がある場合のレイアウト -->
        <div v-if="hasImages" class="relative w-full p-1.5">
            <NuxtImg
                :src="firstImage!.url"
                :alt="setup.name"
                :width="imageSize.width"
                :height="imageSize.height"
                format="avif"
                fit="cover"
                preload
                class="size-full max-h-105 rounded-lg object-cover"
            />
            <div
                :class="[
                    'gradient-overlay',
                    'group absolute inset-1.5 rounded-lg p-2',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100',
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

        <!-- フッター部分（共通） -->
        <div class="flex w-full items-center">
            <UTooltip v-if="!hasImages && firstAvatar" :text="avatarName" :delay-duration="100">
                <!-- 画像がない場合のアバター表示 -->
                <NuxtImg
                    :src="firstAvatar.image || undefined"
                    alt=""
                    :width="88"
                    :height="88"
                    format="avif"
                    class="m-1 aspect-square size-14 shrink-0 rounded-lg object-cover md:size-20"
                />
            </UTooltip>

            <!-- アバターがない場合のプレースホルダー -->
            <UTooltip
                v-else-if="!firstAvatar && !hasImages"
                :text="t('unknownAvatar')"
                :delay-duration="100"
            >
                <div
                    class="text-muted bg-muted m-1 flex size-14 shrink-0 items-center justify-center rounded-lg md:size-20"
                >
                    <Icon name="mingcute:question-fill" size="32" class="text-dimmed" />
                </div>
            </UTooltip>

            <!-- 画像がある場合のメタ情報 -->
            <div v-if="hasImages" class="flex w-full items-center gap-2 px-2 pb-2">
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

            <!-- 画像がない場合のメタ情報 -->
            <div v-else class="flex w-full flex-col items-start justify-center gap-2 pr-2 pl-3">
                <span class="md:text-md text-toned sentence line-clamp-2 text-sm font-medium">
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
