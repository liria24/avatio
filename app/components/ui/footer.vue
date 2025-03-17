<script setup lang="ts">
const modal_feedback = ref(false);
</script>

<template>
    <footer class="self-stretch flex flex-col gap-10">
        <BannerOwnerWarning />

        <UiDivider icon="avatio:avatio" />

        <div
            class="flex flex-wrap gap-x-6 gap-y-2 pb-10 items-center justify-center"
        >
            <div
                class="flex-wrap flex items-center justify-center gap-x-4 gap-y-2 text-zinc-700 dark:text-white"
            >
                <div class="flex items-center gap-2">
                    <Button
                        to="https://x.com/liria_work"
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
                    <Button to="/release" label="お知らせ" variant="link" />

                    <Button
                        label="フィードバック"
                        variant="link"
                        @click="modal_feedback = true"
                    />
                </div>
            </div>
            <div
                class="items-center justify-center gap-x-4 gap-y-2 flex flex-wrap"
            >
                <!-- <Button
                    label="Avatioについて"
                    variant="link"
                /> -->

                <Button to="/faq" label="FAQ" variant="link" />

                <Button to="/terms" label="利用規約" variant="link" />

                <Button
                    to="/privacy-policy"
                    label="プライバシーポリシー"
                    variant="link"
                />
            </div>
            <div class="flex gap-1 items-center">
                <p class="text-zinc-500 text-sm">Copyright © 2025</p>
                <Button
                    to="https://liria.work"
                    new-tab
                    label="Liria"
                    icon="avatio:liria"
                    variant="link"
                    class="gap-1 text-sm font-[Montserrat] font-semibold"
                />
            </div>
        </div>

        <ModalFeedback v-model="modal_feedback" />
    </footer>
</template>
