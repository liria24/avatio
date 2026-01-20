<script lang="ts" setup>
import { LazyModalFeedback } from '#components'

const { app } = useAppConfig()
const overlay = useOverlay()

const modalFeedback = overlay.create(LazyModalFeedback)

const { data: repo } = useFetch<GithubRepo>('https://ungh.cc/repos/liria24/avatio')
</script>

<template>
    <footer class="flex flex-col gap-4 self-stretch pb-6">
        <USeparator icon="avatio:avatio" />

        <LazyBannerOwnerWarning />

        <div
            class="flex w-full flex-col items-center justify-between gap-x-4 gap-y-2 pb-0 sm:flex-row"
        >
            <div class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row">
                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="app.liria.twitter"
                        target="_blank"
                        icon="mingcute:social-x-fill"
                        aria-label="X"
                        variant="ghost"
                    />

                    <LazyUPopover hydrate-on-visible mode="hover" :open-delay="100">
                        <UButton
                            :to="app.repo"
                            target="_blank"
                            icon="mingcute:github-fill"
                            aria-label="GitHub"
                            variant="ghost"
                        />

                        <template #content>
                            <div v-if="repo" class="flex items-center gap-3 p-2">
                                <NuxtImg
                                    v-slot="{ src, imgAttrs, isLoaded }"
                                    :src="app.liria.avatar"
                                    alt="Liria"
                                    loading="lazy"
                                    fetchpriority="low"
                                    :width="48"
                                    :height="48"
                                    format="webp"
                                    custom
                                    class="aspect-square size-12 rounded-lg object-cover"
                                >
                                    <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                                    <USkeleton v-else class="aspect-square size-12 rounded-lg" />
                                </NuxtImg>

                                <div class="flex flex-col gap-2 font-[Geist]">
                                    <span class="text-sm leading-none font-semibold text-nowrap">
                                        {{ repo.repo.repo }}
                                    </span>
                                    <div class="flex items-center gap-1">
                                        <Icon
                                            name="mingcute:star-fill"
                                            size="14"
                                            class="text-muted"
                                        />
                                        <span class="text-muted text-xs leading-none text-nowrap">
                                            {{ repo.repo.stars }}
                                        </span>

                                        <Icon
                                            name="mingcute:git-pull-request-fill"
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
                    </LazyUPopover>
                </div>

                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="$localePath('/changelogs')"
                        label="変更履歴"
                        variant="link"
                        size="sm"
                    />

                    <UButton :to="$localePath('/faq')" label="FAQ" variant="link" size="sm" />

                    <UButton
                        label="フィードバック"
                        variant="link"
                        size="sm"
                        @click="modalFeedback.open()"
                    />
                </div>
            </div>

            <div class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row">
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
                    <p class="text-dimmed text-sm leading-none text-nowrap">© 2025</p>
                    <UButton
                        :to="app.liria.website"
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
