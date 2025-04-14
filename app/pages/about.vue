<script setup lang="ts">
const modalFeedback = ref(false);

useOGP({
    url: 'https://avatio.me/about',
    type: 'website',
    title: 'Avatioについて',
    description: 'VRSNSユーザー向けのアバターセットアップ共有サービス',
    image: 'https://avatio.me/ogp_2.png',
    twitterCard: 'summary_large_image',
});
</script>

<template>
    <div class="w-full flex flex-col gap-14 py-6">
        <!-- ヒーローセクション -->
        <Hero />

        <!-- Avatioとは -->
        <section class="w-full max-w-3xl mx-auto">
            <UiTitle label="Avatioとは" size="lg" />
            <div class="prose dark:prose-invert mt-4">
                <p>
                    Avatioは、VRSNSユーザーがアバターのセットアップ情報を共有するためのプラットフォームです。
                    あなたの「セットアップ」（使用しているアバター、衣装、装飾品、ツールなど）を登録して、他のユーザーと共有しましょう。
                </p>
                <p>
                    アバター改変の参考にしたり、お気に入りのセットアップをブックマークしたり、
                    自分の好きなアバターセットアップを公開することができます。
                </p>
            </div>
        </section>

        <!-- 主な機能 -->
        <section class="w-full max-w-3xl mx-auto">
            <UiTitle label="主な機能" size="lg" />
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:share"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">
                            セットアップの共有
                        </h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        自分のアバターセットアップを投稿して、コミュニティと共有しましょう。
                    </p>
                </div>

                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:image"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">画像添付</h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        セットアップを視覚的に表現するために、画像を添付できます。
                    </p>
                </div>

                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:search"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">セットアップ検索</h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        キーワードやタグを使って、お気に入りのセットアップを探せます。
                    </p>
                </div>

                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:store"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">
                            アイテム情報へすぐにアクセス
                        </h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        使用しているアイテムのBOOTH商品ページへ簡単にアクセスできます。
                    </p>
                </div>

                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:bookmark"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">ブックマーク機能</h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        気に入ったセットアップをブックマークして、後で参照できます。
                    </p>
                </div>

                <div
                    class="flex flex-col gap-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:gift"
                            class="text-primary-500"
                            size="24"
                        />
                        <h3 class="text-lg font-semibold">完全無料</h3>
                    </div>
                    <p class="text-zinc-600 dark:text-zinc-400">
                        Avatioの全ての機能を無料でご利用いただけます。
                    </p>
                </div>
            </div>

            <div class="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <p class="text-sm text-zinc-600 dark:text-zinc-400">
                    <Icon name="lucide:info" class="inline mr-1" size="16" />
                    現在、アバター・アイテムの情報はBOOTH（booth.pm）からのみ取得しています。<br />
                    他のプラットフォームについてのアイデアがあれば、ぜひフィードバックをお願いいたします。
                </p>
            </div>
        </section>

        <!-- 使い方 -->
        <section class="w-full max-w-3xl mx-auto">
            <UiTitle label="使い方" size="lg" />
            <ol class="mt-6 space-y-6">
                <li class="flex gap-4 items-start">
                    <div
                        class="flex items-center justify-center size-8 rounded-full bg-primary-500 text-white font-bold shrink-0"
                    >
                        1
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">アカウント作成</h3>
                        <p class="text-zinc-600 dark:text-zinc-400 mt-1">
                            ログインページからアカウントを作成します。
                        </p>
                    </div>
                </li>

                <li class="flex gap-4 items-start">
                    <div
                        class="flex items-center justify-center size-8 rounded-full bg-primary-500 text-white font-bold shrink-0"
                    >
                        2
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">プロフィール設定</h3>
                        <p class="text-zinc-600 dark:text-zinc-400 mt-1">
                            お好みのプロフィール情報を設定します。アバターやリンクなども追加できます。
                        </p>
                    </div>
                </li>

                <li class="flex gap-4 items-start">
                    <div
                        class="flex items-center justify-center size-8 rounded-full bg-primary-500 text-white font-bold shrink-0"
                    >
                        3
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">
                            セットアップの作成
                        </h3>
                        <p class="text-zinc-600 dark:text-zinc-400 mt-1">
                            あなたのアバターセットアップを登録しましょう。使用しているアバターやアイテムを追加し、画像を添付します。
                        </p>
                    </div>
                </li>

                <li class="flex gap-4 items-start">
                    <div
                        class="flex items-center justify-center size-8 rounded-full bg-primary-500 text-white font-bold shrink-0"
                    >
                        4
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">共有と発見</h3>
                        <p class="text-zinc-600 dark:text-zinc-400 mt-1">
                            セットアップを公開したり、他のユーザーのセットアップを検索・ブックマークしたりして楽しみましょう。
                        </p>
                    </div>
                </li>
            </ol>
        </section>

        <!-- コミュニティ -->
        <section class="w-full max-w-3xl mx-auto">
            <UiTitle label="オープンソースプロジェクト" size="lg" />
            <div class="prose dark:prose-invert mt-4">
                <p>
                    Avatioはオープンソースプロジェクトとして開発されています。バグの報告、新機能の提案、
                    コードの改善など、あらゆる規模・スキルレベルのコントリビュートを歓迎します。
                </p>
                <div class="mt-6 flex flex-wrap gap-2">
                    <Button
                        to="https://github.com/liria24/avatio"
                        new-tab
                        label="GitHub"
                        icon="lucide:github"
                    />
                    <Button
                        label="フィードバック"
                        icon="lucide:message-square"
                        @click="modalFeedback = true"
                    />
                </div>
            </div>
        </section>

        <!-- CTAセクション -->
        <section
            class="w-full max-w-3xl mx-auto bg-gradient-to-br from-primary-500/10 to-primary-600/10 p-6 rounded-2xl"
        >
            <div class="text-center">
                <h2 class="text-2xl font-bold mb-4">
                    アバターセットアップの共有を始めましょう
                </h2>
                <p class="mb-6 text-zinc-700 dark:text-zinc-300">
                    Avatioで自分だけのアバターセットアップを共有しましょう。
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <Button
                        to="/login"
                        label="ログイン"
                        icon="lucide:log-in"
                        class="px-8 py-2.5"
                    />
                    <Button
                        to="/"
                        label="ホームに戻る"
                        icon="lucide:home"
                        variant="flat"
                        class="px-8 py-2.5"
                    />
                </div>
            </div>
        </section>

        <ModalFeedback v-model="modalFeedback" />
    </div>
</template>
