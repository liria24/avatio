<script lang="ts" setup>
import { en, ja } from '@nuxt/ui/locale'

definePageMeta({
    middleware: 'authed',
})

const { t } = useI18n()

const { app } = useAppConfig()
const { locale, setLocale } = useI18n()

const i18nFileLinks = {
    en: `${app.repo}/blob/main/i18n/en-US.ts`,
    ja: `${app.repo}/blob/main/i18n/ja-JP.ts`,
}

defineSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings">
        <section id="site" class="flex flex-col gap-4">
            <h1 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.site.title') }}
            </h1>

            <UCard>
                <div class="flex w-full flex-col gap-6">
                    <div class="flex w-full flex-col gap-3">
                        <UPageCard
                            :title="$t('settings.site.language')"
                            :description="$t('settings.site.languageDescription')"
                            orientation="horizontal"
                            variant="naked"
                        >
                            <ULocaleSelect
                                :model-value="locale"
                                :locales="[en, ja]"
                                variant="subtle"
                                color="neutral"
                                class="ml-auto w-fit min-w-48"
                                @update:model-value="setLocale($event as 'en' | 'ja')"
                            />
                        </UPageCard>

                        <UCard
                            v-if="locale !== 'ja'"
                            variant="soft"
                            :ui="{ body: 'flex flex-col items-start gap-3' }"
                        >
                            <p class="text-xs">{{ $t('settings.site.improveTranslation') }}</p>

                            <UButton
                                :to="i18nFileLinks[locale]"
                                target="_blank"
                                icon="mingcute:github-fill"
                                :label="$t('settings.site.editOnGitHub')"
                                variant="outline"
                                size="sm"
                            />
                        </UCard>
                    </div>

                    <UPageCard
                        :title="$t('settings.site.theme')"
                        :description="$t('settings.site.themeDescription')"
                        orientation="horizontal"
                        variant="naked"
                    >
                        <UColorModeSelect
                            variant="subtle"
                            color="neutral"
                            class="ml-auto w-fit min-w-48"
                        />
                    </UPageCard>
                </div>
            </UCard>
        </section>
    </NuxtLayout>
</template>
