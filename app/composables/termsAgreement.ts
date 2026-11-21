import type { LegalDocument, LegalDocumentStatus, LegalStatus } from '@avatio/core/legal'

type PendingLegalDocument = LegalDocumentStatus & { agreement: 'initial' | 'updated' }

interface TermsAgreementState {
    owner: string
    status: LegalStatus | null
    error: boolean
    pending: boolean
    sequence: number
}

export const useTermsAgreement = () => {
    const { user } = useUserSession()
    const { locale } = useI18n()
    const modal = useAgreeTermsModal()
    const requestFetch = useRequestFetch()
    const state = useState<TermsAgreementState>('terms-agreement', () => ({
        owner: '',
        status: null,
        error: false,
        pending: false,
        sequence: 0,
    }))
    const owner = computed(() => `${user.value?.id ?? 'anonymous'}:${locale.value}`)

    const refresh = async (force = true) => {
        const expectedOwner = owner.value
        if (state.value.owner !== expectedOwner) {
            state.value = {
                owner: expectedOwner,
                status: null,
                error: false,
                pending: false,
                sequence: state.value.sequence + 1,
            }
        }
        if (!user.value || (state.value.pending && !force)) return

        const sequence = ++state.value.sequence
        state.value.pending = true
        state.value.error = false
        try {
            const status = await requestFetch<LegalStatus>('/api/avatio/legal/status', {
                query: { locale: locale.value },
            })
            if (sequence === state.value.sequence && expectedOwner === owner.value)
                state.value.status = status
        } catch (error) {
            console.error('Failed to load legal status:', error)
            if (sequence === state.value.sequence && expectedOwner === owner.value)
                state.value.error = true
        } finally {
            if (sequence === state.value.sequence) state.value.pending = false
        }
    }

    if (import.meta.client)
        watch(
            owner,
            () => {
                void refresh(false)
            },
            { immediate: true },
        )

    const pendingDocuments = computed(() =>
        state.value.owner === owner.value
            ? (state.value.status?.documents.filter(
                  (document): document is PendingLegalDocument =>
                      document.active && !document.accepted && document.agreement !== null,
              ) ?? [])
            : [],
    )
    const agree = async (
        documents: { document: LegalDocument; version: string; sourceRevision: string }[],
    ) => {
        const expectedOwner = owner.value
        const status = await requestFetch<LegalStatus>('/api/avatio/legal/accept', {
            method: 'POST',
            body: { locale: locale.value, documents },
        })
        if (expectedOwner === owner.value) state.value.status = status
    }
    return {
        status: computed(() => (state.value.owner === owner.value ? state.value.status : null)),
        pending: computed(() => state.value.pending),
        error: computed(() => state.value.error),
        pendingDocuments,
        needsAgreement: computed(() => pendingDocuments.value.length > 0),
        modalKey: computed(() =>
            pendingDocuments.value.length
                ? `${user.value?.id}:${pendingDocuments.value
                      .map((document) => `${document.document}:${document.version}`)
                      .join(',')}`
                : '',
        ),
        refresh,
        agree,
        open: () =>
            modal.open({
                documents: pendingDocuments.value.map(({ document, agreement }) => ({
                    document,
                    agreement,
                })),
            }),
        close: () => modal.close(),
    }
}
