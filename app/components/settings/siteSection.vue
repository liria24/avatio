<script lang="ts" setup>
import { en, ja } from '@nuxt/ui/locale'

const { app } = useAppConfig()
const { locale, localeProperties, setLocale } = useI18n()
</script>

<template>
    <section id="site" class="flex flex-col gap-4">
        <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.general.site.title') }}
        </h3>

        <UCard>
            <div class="flex w-full flex-col gap-6">
                <div class="flex w-full flex-col gap-3">
                    <UPageCard
                        :title="$t('settings.general.site.language')"
                        :description="$t('settings.general.site.languageDescription')"
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
                        <p class="text-xs">
                            {{ $t('settings.general.site.improveTranslation') }}
                        </p>

                        <UButton
                            :to="`${app.repo}/blob/main/i18n/locales/${localeProperties.language}.json`"
                            target="_blank"
                            icon="mingcute:github-fill"
                            :label="$t('settings.general.site.editOnGitHub')"
                            variant="outline"
                            size="sm"
                        />
                    </UCard>
                </div>

                <UPageCard
                    :title="$t('settings.general.site.theme')"
                    :description="$t('settings.general.site.themeDescription')"
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
</template>
