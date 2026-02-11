<script lang="ts" setup>
import { en, ja } from '@nuxt/ui/locale'

interface Props {
    sectionId: string
}
const { sectionId } = defineProps<Props>()

const { locale, setLocale } = useI18n()

const i18nFileLinks = {
    en: 'https://github.com/liria24/avatio/blob/main/i18n/en-US.ts',
    ja: 'https://github.com/liria24/avatio/blob/main/i18n/ja-JP.ts',
}
</script>

<template>
    <section :id="sectionId" class="flex flex-col gap-4">
        <h2 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.site.title') }}
        </h2>

        <UCard>
            <div class="flex w-full flex-col gap-6">
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

                <UCard v-if="locale !== 'ja'" variant="soft">
                    <p>翻訳の改善にご協力いただける場合こちら</p>

                    <UButton
                        :to="i18nFileLinks[locale]"
                        icon="mingcute:github-fill"
                        label="GitHubで編集"
                        variant="outline"
                    />
                </UCard>

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
</template>
