<script lang="ts" setup>
interface Props {
    needsTerms?: boolean
    needsPrivacyPolicy?: boolean
}
const { needsTerms = true, needsPrivacyPolicy = false } = defineProps<Props>()

const emit = defineEmits(['close'])

const { t } = useI18n()
const { agree } = useTermsAgreement()
const isAgreeing = ref(false)

const variant = computed(() => {
    if (needsTerms && needsPrivacyPolicy) return 'both'
    if (needsPrivacyPolicy) return 'privacy'
    return 'terms'
})

const title = computed(() => t(`modal.agreeTerms.title.${variant.value}`))
const description = computed(() => t(`modal.agreeTerms.description.${variant.value}`))

const agreeAndClose = async () => {
    isAgreeing.value = true
    try {
        await agree()
        emit('close')
    } catch (error) {
        console.error('Failed to update terms agreement:', error)
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
                {{ $t('modal.agreeTerms.intro') }}<br />
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
        </template>

        <template #footer>
            <UButton
                :label="$t('modal.agreeTerms.agree')"
                color="neutral"
                size="lg"
                block
                :loading="isAgreeing"
                @click="agreeAndClose"
            />
        </template>
    </UModal>
</template>
