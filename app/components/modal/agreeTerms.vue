<script lang="ts" setup>
import type { LegalDocument } from '@avatio/core/legal'
import type { AvatioContentPage } from '@avatio/nuxt/runtime/content'

interface Props {
    documents: { document: LegalDocument; agreement: 'initial' | 'updated' }[]
}
const { documents } = defineProps<Props>()
const documentIds = computed(() => documents.map(({ document }) => document))
const needsTerms = computed(() => documentIds.value.includes('terms'))
const needsPrivacyPolicy = computed(() => documentIds.value.includes('privacy-policy'))
const hasInitial = computed(() => documents.some(({ agreement }) => agreement === 'initial'))
const hasUpdated = computed(() => documents.some(({ agreement }) => agreement === 'updated'))

const emit = defineEmits(['close'])

const { t, locale } = useI18n()
const { agree } = useTermsAgreement()
const isAgreeing = ref(false)
const failure = ref(false)
const requestFetch = useRequestFetch()
const {
    data: pages,
    error,
    status,
    refresh,
} = useAsyncData(
    () => `legal-review:${locale.value}:${documentIds.value.join(',')}`,
    () =>
        Promise.all(
            documentIds.value.map(async (document) => ({
                document,
                page: await requestFetch<AvatioContentPage>(`/api/avatio/content/${document}`, {
                    query: { locale: locale.value },
                }),
            })),
        ),
)

const title = computed(() => {
    if (hasInitial.value && hasUpdated.value) return t('modal.agreeTerms.mixed.title')
    if (hasInitial.value) return t('modal.agreeTerms.initial.title')
    if (needsTerms.value && needsPrivacyPolicy.value) return t('modal.agreeTerms.title.both')
    if (needsPrivacyPolicy.value) return t('modal.agreeTerms.title.privacy')
    return t('modal.agreeTerms.title.terms')
})
const description = computed(() => {
    if (hasInitial.value && hasUpdated.value) return t('modal.agreeTerms.mixed.description')
    if (hasInitial.value) return t('modal.agreeTerms.initial.description')
    if (needsTerms.value && needsPrivacyPolicy.value) return t('modal.agreeTerms.description.both')
    if (needsPrivacyPolicy.value) return t('modal.agreeTerms.description.privacy')
    return t('modal.agreeTerms.description.terms')
})
const intro = computed(() =>
    hasInitial.value ? t('modal.agreeTerms.initial.intro') : t('modal.agreeTerms.intro'),
)

const agreeAndClose = async () => {
    isAgreeing.value = true
    failure.value = false
    try {
        if (!pages.value?.length) return
        await agree(
            pages.value.map(({ document, page }) => ({
                document,
                version: page.frontmatter.version ?? '',
                sourceRevision: page.source.sourceRevision,
            })),
        )
        emit('close')
    } catch (error) {
        console.error('Failed to update terms agreement:', error)
        failure.value = true
        await refresh()
    } finally {
        isAgreeing.value = false
    }
}
</script>

<template>
    <UModal
        :title
        :close="false"
        :dismissible="false"
        :ui="{
            header: 'p-4 sm:p-4 min-h-0',
            body: 'p-4 sm:p-4 flex flex-col items-start gap-3',
            footer: 'p-4 sm:p-4',
            content: 'max-w-xl p-4 sm:p-8 rounded-2xl divide-y-0',
            close: 'sm:top-6 sm:right-6',
        }"
    >
        <template #body>
            <p class="text-toned text-sm">
                {{ intro }}
                <br />
                {{ description }}
            </p>
            <UButton
                v-if="needsTerms"
                :to="$localePath('/terms')"
                target="_blank"
                :label="$t('modal.agreeTerms.reviewTerms')"
                variant="link"
                color="neutral"
                class="p-0"
            />
            <UButton
                v-if="needsPrivacyPolicy"
                :to="$localePath('/privacy-policy')"
                target="_blank"
                :label="$t('modal.agreeTerms.reviewPrivacy')"
                variant="link"
                color="neutral"
                class="p-0"
            />
            <UAlert v-if="error || failure" :title="$t('content.loadError')" color="error" />
            <UButton v-if="error" :label="$t('content.retry')" @click="refresh()" />
            <div class="max-h-72 w-full overflow-y-auto">
                <details v-for="{ document, page } in pages" :key="document" class="py-2">
                    <summary class="cursor-pointer font-medium">
                        {{ page.frontmatter.title }} · {{ page.frontmatter.version }}
                    </summary>
                    <p v-if="page.isFallback" class="text-muted my-2 text-sm">
                        {{ $t('content.fallbackDescription') }}
                    </p>
                    <MarkdownDocument :value="page.document" class="sentence text-sm" />
                </details>
            </div>
        </template>

        <template #footer>
            <UButton
                :label="$t('modal.agreeTerms.agree')"
                color="neutral"
                size="lg"
                block
                :loading="isAgreeing"
                :disabled="status !== 'success' || !pages?.length || !!error"
                @click="agreeAndClose"
            />
        </template>
    </UModal>
</template>
