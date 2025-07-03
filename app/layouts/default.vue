<script lang="ts" setup>
const session = await useGetSession()
const route = useRoute()
const footerExclude = ['/setup/compose']

const modalFeedback = ref(false)
const modalLogin = ref(false)

const { data: repo } = useFetch<{ repo: GithubRepo }>(
    'https://ungh.cc/repos/liria24/avatio'
)
</script>

<template>
    <Html lang="ja">
        <Head>
            <Title>Avatio</Title>
            <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            <Meta name="lang" content="ja" />
        </Head>
        <Body>
            <UContainer
                class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8"
            >
                <ModalFeedback v-model:open="modalFeedback" />
                <ModalLogin v-model:open="modalLogin" />

                <Header @open-feedback-modal="modalFeedback = true" />

                <div
                    class="hidden w-full items-center justify-center rounded-xl bg-red-100 p-4 text-sm text-red-800 ring-2 ring-red-500 noscript:flex"
                >
                    この Web サイトは JavaScript を使用しています。<br />
                    JavaScript が無効の場合、正しく表示されません。
                </div>
                <main class="grid w-full grow">
                    <slot />
                </main>

                <footer
                    v-if="!footerExclude.includes(route.path)"
                    class="flex flex-col gap-4 self-stretch pb-6"
                >
                    <USeparator icon="avatio:avatio" />

                    <BannerOwnerWarning />

                    <div
                        class="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-0"
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
                                            src="https://avatars.githubusercontent.com/u/172270941?v=4"
                                            alt="Liria"
                                            loading="lazy"
                                            format="webp"
                                            class="size-12 rounded-lg"
                                        />

                                        <div
                                            class="flex flex-col gap-2 font-[Geist]"
                                        >
                                            <span
                                                class="text-sm leading-none font-semibold text-nowrap"
                                            >
                                                {{ repo.repo.repo }}
                                            </span>
                                            <div
                                                class="flex items-center gap-1"
                                            >
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
                                                    :datetime="
                                                        repo.repo.updatedAt
                                                    "
                                                    date-style="short"
                                                    time-style="short"
                                                    class="text-muted text-xs leading-none text-nowrap"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </UPopover>

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
                                @click="
                                    () => {
                                        if (session) modalFeedback = true
                                        else modalLogin = true
                                    }
                                "
                            />
                        </div>

                        <div
                            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
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
                                    label="プライバシーポリシー"
                                    variant="link"
                                    size="sm"
                                />
                            </div>

                            <div class="flex items-center gap-1">
                                <p class="text-dimmed text-sm">© 2025</p>
                                <UButton
                                    to="https://liria.me"
                                    target="_blank"
                                    label="Liria"
                                    icon="avatio:liria"
                                    variant="link"
                                    size="sm"
                                    class="gap-1 p-0 pl-0.5 font-[Montserrat] text-sm font-semibold"
                                />
                            </div>
                        </div>
                    </div>
                </footer>
            </UContainer>
        </Body>
    </Html>
</template>
