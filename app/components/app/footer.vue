<script lang="ts" setup>
const { app } = useAppConfig()
const { feedback } = useAppOverlay()
const { dismissed, dismissBanner } = useOwnerWarningBanner()
</script>

<template>
    <footer class="flex flex-col self-stretch pb-6">
        <USeparator icon="avatio:avatio" />

        <ClientOnly>
            <LazyBannerOwnerWarning v-if="!dismissed" class="mt-4" @close="dismissBanner" />
        </ClientOnly>

        <div
            class="mt-4 flex w-full flex-col items-center justify-between gap-x-4 gap-y-2 pb-0 sm:flex-row"
        >
            <div class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row">
                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="app.liria.twitter"
                        target="_blank"
                        external
                        icon="mingcute:social-x-fill"
                        :aria-label="$t('footer.social.x')"
                        variant="ghost"
                    />

                    <UButton
                        :to="app.repo"
                        target="_blank"
                        external
                        icon="mingcute:github-fill"
                        :aria-label="$t('footer.social.github')"
                        variant="ghost"
                    />
                </div>

                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="$localePath('/changelogs')"
                        :label="$t('footer.links.changelogs')"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        :to="$localePath('/faq')"
                        :label="$t('footer.links.faq')"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        :label="$t('footer.links.feedback')"
                        variant="link"
                        size="sm"
                        @click="feedback.open()"
                    />
                </div>
            </div>

            <div class="flex flex-col items-center justify-center gap-x-4 gap-y-2 sm:flex-row">
                <div class="flex items-center gap-0.5">
                    <UButton
                        :to="$localePath('/terms')"
                        :label="$t('footer.legal.terms')"
                        variant="link"
                        size="sm"
                    />

                    <UButton
                        :to="$localePath('/privacy-policy')"
                        :label="$t('footer.legal.privacy')"
                        variant="link"
                        size="sm"
                    />
                </div>

                <div class="flex items-center gap-1.5">
                    <p class="text-muted text-sm leading-none text-nowrap">© 2025</p>
                    <UButton
                        :to="app.liria.website"
                        target="_blank"
                        label="Liria"
                        trailing-icon="avatio:liria"
                        variant="link"
                        size="sm"
                        :ui="{ trailingIcon: 'size-3.5' }"
                        class="text-muted gap-1 p-0 text-sm font-bold"
                    />
                </div>
            </div>
        </div>
    </footer>
</template>
