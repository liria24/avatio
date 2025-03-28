<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

interface Props {
    noUser?: boolean;
    setup: SetupClient;
    class?: string;
}
const { noUser, setup, class: propClass } = defineProps<Props>();
const emit = defineEmits(['click']);
const colorMode = useColorMode();

const date = new Date(setup.created_at);
const dateLocale = computed(() => {
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
});

const hasValidAvatar = computed(() => {
    return !!setup.items.avatar?.length && !setup.items.avatar[0]?.outdated;
});

const avatarName = computed(() => {
    if (!hasValidAvatar.value) return '不明なベースアバター';
    const avatar = setup.items.avatar?.[0];
    return avatar ? useAvatarName(avatar.name) : '不明なベースアバター';
});

const hasSetupImages = computed(() => {
    return !!setup.images?.length && !!setup.images[0];
});

const dominantColor = ref('');
const adjustedColor = ref('');

const adjustColorForTheme = (hex: string, isDark: boolean) => {
    if (!hex) return '';

    const luminance = getLuminance(hex);
    const { r, g, b } = hexToRgb(hex);

    // ダークモード
    if (isDark) {
        // 明るさの下限と上限を設定
        const targetLuminance = Math.max(0.4, Math.min(0.65, luminance));
        const factor = targetLuminance / (luminance || 0.1);

        return rgbToHex(
            Math.min(255, Math.max(30, r * factor)),
            Math.min(255, Math.max(30, g * factor)),
            Math.min(255, Math.max(30, b * factor))
        );
    }
    // ライトモード
    else {
        // 暗さの下限と上限を設定
        const targetLuminance = Math.max(0.25, Math.min(0.6, luminance));
        const factor = targetLuminance / (luminance || 0.1);

        return rgbToHex(
            Math.min(220, Math.max(20, r * factor)),
            Math.min(220, Math.max(20, g * factor)),
            Math.min(220, Math.max(20, b * factor))
        );
    }
};

const extractImageColor = async (event: Event) => {
    const target = event.target as HTMLImageElement;
    if (!target || !(target instanceof HTMLImageElement)) return;

    try {
        const { extractColors } = await import('extract-colors');

        // 画像から色を抽出
        const colors = await extractColors(target, {
            pixels: 1000,
            distance: 0.2,
            saturationDistance: 0.2,
            lightnessDistance: 0.5,
        });

        if (colors?.length > 0 && colors[0]) {
            const extractedColor = colors[0].hex || '';
            dominantColor.value = extractedColor;

            const isDark = colorMode.value === 'dark';
            adjustedColor.value = adjustColorForTheme(extractedColor, isDark);
        }
    } catch (error) {
        console.error('色の抽出に失敗しました:', error);
        dominantColor.value = '';
        adjustedColor.value = '';
    }
};

// テーマ変更時に色を再調整するウォッチャー
watch(
    () => colorMode.value,
    (newMode) => {
        if (dominantColor.value) {
            const isDark = newMode === 'dark';
            adjustedColor.value = adjustColorForTheme(
                dominantColor.value,
                isDark
            );
        }
    }
);

const gradientColor = computed(() => {
    if (!adjustedColor.value) return 'rgba(0,0,0,0.6)';

    const { r, g, b } = hexToRgb(adjustedColor.value);
    const darkeningFactor = 0.2;
    return `rgba(${Math.round(r * darkeningFactor)}, ${Math.round(g * darkeningFactor)}, ${Math.round(b * darkeningFactor)}, 0.5)`;
});

const elementStyle = computed(() => {
    if (!adjustedColor.value) return {};
    return {
        '--dominant-color': adjustedColor.value,
        '--gradient-color': gradientColor.value,
    };
});

const gradientStyle = computed(() => {
    if (!adjustedColor.value)
        return 'background-image: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)';
    return `background-image: linear-gradient(to top, var(--gradient-color) 0%, transparent 60%)`;
});

const linkClasses = computed(() => {
    return twMerge(
        'group flex flex-col rounded-lg overflow-clip',
        adjustedColor.value
            ? 'hover:ring-2 hover:ring-[var(--dominant-color)] hover:bg-[var(--dominant-color)]/20'
            : 'hover:ring-2 hover:ring-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'hover:shadow-xl shadow-black/10 dark:shadow-white/10',
        'transition duration-50 ease-in-out',
        propClass
    );
});
</script>

<template>
    <NuxtLink
        tabindex="0"
        :to="{ name: 'setup-id', params: { id: setup.id } }"
        :class="linkClasses"
        :style="elementStyle"
        @click="emit('click')"
    >
        <div v-if="hasSetupImages" class="relative w-full p-1.5">
            <NuxtImg
                :src="
                    useGetImage(setup.images[0]?.name, {
                        prefix: 'setup',
                    })
                "
                :alt="setup.name"
                format="webp"
                :width="setup.images[0]?.width ?? 640"
                :height="setup.images[0]?.height ?? 360"
                :placeholder="[
                    setup.images[0]?.width ?? 192,
                    setup.images[0]?.height ?? 108,
                    75,
                    5,
                ]"
                loading="lazy"
                fit="cover"
                class="size-full max-h-[420px] rounded-lg object-cover"
                @load="extractImageColor"
            />
            <div
                :class="[
                    'absolute inset-1.5 p-2 rounded-lg',
                    'flex flex-col items-start justify-end gap-1',
                    'opacity-0 group-hover:opacity-100',
                    'transition duration-100 ease-in-out',
                ]"
                :style="gradientStyle"
            >
                <span
                    class="text-sm md:text-md font-medium break-all line-clamp-2 text-white"
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
                        class="text-xs break-all line-clamp-1 leading-none text-zinc-300"
                    >
                        {{ avatarName }}
                    </span>
                </div>
            </div>
        </div>

        <div class="w-full flex items-center">
            <UiTooltip
                v-if="!hasSetupImages && hasValidAvatar"
                :text="avatarName"
            >
                <NuxtImg
                    :src="setup.items.avatar?.[0]?.thumbnail"
                    :alt="setup.name"
                    :placeholder="[30, 30, 75, 5]"
                    format="webp"
                    :width="80"
                    :height="80"
                    loading="lazy"
                    fit="cover"
                    class="h-14 md:h-20 my-1.5 ml-1.5 rounded-lg overflow-clip shrink-0 object-cover"
                />
            </UiTooltip>

            <div
                v-else-if="!hasValidAvatar && !hasSetupImages"
                class="size-14 my-1.5 ml-1.5 rounded-lg flex shrink-0 items-center justify-center text-zinc-400 bg-zinc-300 dark:bg-zinc-600"
            >
                ?
            </div>

            <div
                v-if="!hasSetupImages"
                class="w-full pr-2 pl-3 flex flex-col items-start justify-center gap-2"
            >
                <span
                    class="text-sm md:text-md font-medium text-zinc-700 dark:text-zinc-200 break-keep line-clamp-2"
                >
                    {{ useSentence(setup.name) }}
                </span>

                <div class="flex items-center gap-2">
                    <HovercardUser v-if="!noUser" :user="setup.author">
                        <UiAvatar
                            :url="
                                useGetImage(setup.author.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="setup.author.name ?? ''"
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
                <HovercardUser v-if="!noUser" :user="setup.author">
                    <UiAvatar
                        :url="
                            useGetImage(setup.author.avatar, {
                                prefix: 'avatar',
                            })
                        "
                        :alt="setup.author.name ?? ''"
                        aria-hidden="true"
                        :icon-size="12"
                        class="size-5"
                    />
                </HovercardUser>
            </div>
        </div>
    </NuxtLink>
</template>
