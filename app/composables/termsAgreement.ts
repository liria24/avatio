import type { LegalDocument, LegalStatus } from '@avatio/core/legal'

export const useTermsAgreement = () => {
    const { user } = useUserSession()
    const { locale } = useI18n()
    const modal = useAgreeTermsModal()
    const requestFetch = useRequestFetch()
    const key = computed(() => `legal-status:${user.value?.id ?? 'anonymous'}:${locale.value}`)
    const { data, refresh, error } = useAsyncData(
        key,
        () =>
            user.value
                ? requestFetch<LegalStatus>('/api/avatio/legal/status', {
                      query: { locale: locale.value },
                  })
                : Promise.resolve(null),
        { server: false },
    )
    const pending = computed(
        () =>
            data.value?.documents.filter((document) => document.active && !document.accepted) ?? [],
    )
    const agree = async (
        documents: { document: LegalDocument; version: string; sourceRevision: string }[],
    ) => {
        data.value = await $fetch<LegalStatus>('/api/avatio/legal/accept', {
            method: 'POST',
            body: { locale: locale.value, documents },
        })
    }
    return {
        needsAgreement: computed(() => Boolean(user.value && data.value?.needsAgreement)),
        error,
        refresh,
        agree,
        open: () => modal.open({ documents: pending.value.map((document) => document.document) }),
    }
}
