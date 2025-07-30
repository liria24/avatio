<script lang="ts" setup>
const emit = defineEmits<{
    (e: 'open-feedback-modal'): void
}>()

const { data: repo } = useFetch<{ repo: GithubRepo }>(
    'https://ungh.cc/repos/liria24/avatio'
)
</script>

<template>
    <footer class="flex flex-col gap-4 self-stretch pb-6">
        <USeparator icon="avatio:avatio" />

        <BannerOwnerWarning />

        <div
            class="flex w-full flex-col items-center justify-between gap-x-4 gap-y-2 pb-0 sm:flex-row"
        >
            <div
                class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row"
            >
                <div class="flex items-center gap-0.5">
                    <UButton
                        to="https://x.com/liria_24"
                        target="_blank"
                        icon="simple-icons:x"
                        aria-label="X"
                        variant="ghost"
                        size="sm"
                        class="p-2"
                    />

                    <UPopover mode="hover" :open-delay="100">
                        <UButton
                            to="https://github.com/liria24/avatio"
                            target="_blank"
                            icon="simple-icons:github"
                            aria-label="GitHub"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                        />

                        <template #content>
                            <div
                                v-if="repo"
                                class="flex items-center gap-3 p-2"
                            >
                                <NuxtImg
                                    v-slot="{ src, imgAttrs, isLoaded }"
                                    src="https://avatars.githubusercontent.com/u/172270941?v=4"
                                    alt="Liria"
                                    loading="lazy"
                                    :width="48"
                                    :height="48"
                                    format="webp"
                                    custom
                                    class="aspect-square size-12 rounded-lg object-cover"
                                >
                                    <img
                                        v-if="isLoaded"
                                        v-bind="imgAttrs"
                                        :src="src"
                                    />
                                    <USkeleton
                                        v-else
                                        class="aspect-square size-12 rounded-lg"
                                    />
                                </NuxtImg>

                                <div class="flex flex-col gap-2 font-[Geist]">
                                    <span
                                        class="text-sm leading-none font-semibold text-nowrap"
                                    >
                                        {{ repo.repo.repo }}
                                    </span>
                                    <div class="flex items-center gap-1">
                                        <Icon
                                            name="lucide:star"
                                            size="14"
                                            class="text-muted"
                                        />
                                        <span
                                            class="text-muted text-xs leading-none text-nowrap"
                                        >
                                            {{ repo.repo.stars }}
                                        </span>

                                        <Icon
                                            name="lucide:git-pull-request-arrow"
                                            size="14"
                                            class="text-muted ml-2"
                                        />
                                        <NuxtTime
                                            :datetime="repo.repo.updatedAt"
                                            date-style="short"
                                            time-style="short"
                                            class="text-muted text-xs leading-none text-nowrap"
                                        />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </UPopover>
                </div>

                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="$localePath('/changelogs')"
                        label="変更履歴"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        :to="$localePath('/faq')"
                        label="FAQ"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        label="フィードバック"
                        variant="link"
                        size="sm"
                        @click="emit('open-feedback-modal')"
                    />
                </div>
            </div>

            <div
                class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row"
            >
                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="$localePath('/terms')"
                        label="利用規約"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        :to="$localePath('/privacy-policy')"
                        label="プライバシー"
                        variant="link"
                        size="sm"
                    />
                </div>

                <div class="flex items-center gap-1.5 font-[Geist]">
                    <p class="text-dimmed text-sm leading-none text-nowrap">
                        © 2025
                    </p>
                    <UButton
                        to="https://liria.me"
                        target="_blank"
                        label="Liria"
                        trailing-icon="avatio:liria"
                        variant="link"
                        size="sm"
                        :ui="{ trailingIcon: 'size-3.5' }"
                        class="text-dimmed gap-1 p-0 text-sm font-bold"
                    />
                </div>
            </div>
        </div>
    </footer>
</template>
