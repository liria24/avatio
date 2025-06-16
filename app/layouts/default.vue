<script lang="ts" setup>
const route = useRoute()
const paddingExclude = ['/', '/release', '/setup/compose']
const footerExclude = ['/setup/compose']
const modal_feedback = ref(false)
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
                class="flex min-h-[100dvh] flex-col items-center gap-6 pt-6 md:gap-8"
            >
                <Header />
                <div
                    class="hidden w-full items-center justify-center rounded-xl bg-red-100 p-4 text-sm text-red-800 ring-2 ring-red-500 noscript:flex"
                >
                    この Web サイトは JavaScript を使用しています。<br />
                    JavaScript が無効の場合、正しく表示されません。
                </div>
                <main
                    :class="[
                        'grid w-full grow',
                        paddingExclude.includes(route.path)
                            ? 'px-4'
                            : 'md:px-20 lg:px-32',
                    ]"
                >
                    <slot />
                </main>

                <footer
                    v-if="!footerExclude.includes(route.path)"
                    class="flex flex-col gap-10 self-stretch"
                >
                    <USeparator icon="avatio:avatio" />

                    <BannerOwnerWarning />

                    <div
                        class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-10"
                    >
                        <div
                            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-zinc-700 dark:text-white"
                        >
                            <div class="flex items-center gap-2">
                                <Button
                                    to="https://x.com/liria_24"
                                    new-tab
                                    icon="simple-icons:x"
                                    aria-label="X"
                                    variant="flat"
                                    class="p-2"
                                />

                                <Button
                                    to="https://github.com/liria24/avatio"
                                    new-tab
                                    icon="simple-icons:github"
                                    aria-label="GitHub"
                                    variant="flat"
                                    class="p-2"
                                />
                            </div>

                            <div class="flex items-center gap-4">
                                <Button
                                    to="/release"
                                    label="お知らせ"
                                    variant="link"
                                />

                                <Button
                                    label="フィードバック"
                                    variant="link"
                                    @click="modal_feedback = true"
                                />
                            </div>
                        </div>
                        <div
                            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
                        >
                            <Button to="/faq" label="FAQ" variant="link" />

                            <Button
                                to="/terms"
                                label="利用規約"
                                variant="link"
                            />

                            <Button
                                to="/privacy-policy"
                                label="プライバシーポリシー"
                                variant="link"
                            />
                        </div>
                        <div class="flex items-center gap-1">
                            <p class="text-sm text-zinc-500">
                                Copyright © 2025
                            </p>
                            <Button
                                to="https://liria.me"
                                new-tab
                                label="Liria"
                                icon="avatio:liria"
                                variant="link"
                                class="gap-1 font-[Montserrat] text-sm font-semibold"
                            />
                        </div>
                    </div>

                    <ModalFeedback v-model="modal_feedback" />
                </footer>
            </UContainer>
        </Body>
    </Html>
</template>
