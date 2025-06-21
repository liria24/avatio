<script lang="ts" setup>
const session = await useGetSession()
const route = useRoute()
const footerExclude = ['/setup/compose']
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
                <Header />
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
                    class="flex flex-col gap-10 self-stretch pb-8"
                >
                    <USeparator icon="avatio:avatio" />

                    <BannerOwnerWarning />

                    <div
                        class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-0"
                    >
                        <div
                            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
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

                                <UButton
                                    to="https://github.com/liria24/avatio"
                                    target="_blank"
                                    icon="simple-icons:github"
                                    aria-label="GitHub"
                                    variant="ghost"
                                    size="sm"
                                    class="p-2"
                                />
                            </div>

                            <div class="flex items-center gap-4">
                                <UButton
                                    :to="$localePath('/release')"
                                    label="お知らせ"
                                    variant="link"
                                    size="sm"
                                    class="p-0"
                                />

                                <ModalFeedback v-if="session">
                                    <UButton
                                        label="フィードバック"
                                        variant="link"
                                        size="sm"
                                        class="p-0"
                                    />
                                </ModalFeedback>
                                <ModalLogin v-else>
                                    <UButton
                                        label="フィードバック"
                                        variant="link"
                                        size="sm"
                                        class="p-0"
                                    />
                                </ModalLogin>
                            </div>
                        </div>
                        <div
                            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
                        >
                            <UButton
                                :to="$localePath('/faq')"
                                label="FAQ"
                                variant="link"
                                size="sm"
                                class="p-0"
                            />

                            <UButton
                                :to="$localePath('/terms')"
                                label="利用規約"
                                variant="link"
                                size="sm"
                                class="p-0"
                            />

                            <UButton
                                :to="$localePath('/privacy-policy')"
                                label="プライバシーポリシー"
                                variant="link"
                                size="sm"
                                class="p-0"
                            />
                        </div>
                        <div class="flex items-center gap-1">
                            <p class="text-dimmed text-sm">Copyright © 2025</p>
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
                </footer>
            </UContainer>
            <ModalLogin v-if="!session && route.path === '/login'" />
            <!-- <ModalFeedback v-model="modal_feedback" /> -->
        </Body>
    </Html>
</template>
