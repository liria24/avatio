import { z } from 'zod'

const createReportSchema = (t: (key: string) => string) =>
    z
        .object({
            reportReason: z.string().array().min(1, t('reports.validation.selectReason')),
            comment: z.string().optional(),
        })
        .refine(
            (data) => {
                if (data.reportReason.includes('other'))
                    return data.comment && data.comment.trim().length > 0
                return true
            },
            {
                message: t('reports.validation.otherRequiresComment'),
                path: ['comment'],
            },
        )

type ReportState = {
    reportReason: string[]
    comment?: string
}

const useReport = (
    subject: 'item' | 'setup' | 'user',
    submitReport: (state: ReportState, idempotencyKey: string) => Promise<unknown>,
) => {
    const { t } = useI18n()
    const toast = useToast()
    const schema = createReportSchema(t)
    const state = reactive<ReportState>({
        reportReason: [],
        comment: '',
    })
    let idempotencyKey = crypto.randomUUID()

    const submit = async () => {
        try {
            await schema.parseAsync(state)
            await submitReport(state, idempotencyKey)

            toast.add({
                icon: 'mingcute:check-line',
                title: t('toast.reports.submitted'),
                description: t('toast.reports.submittedDescription'),
                color: 'success',
            })

            state.reportReason = []
            state.comment = ''
            idempotencyKey = crypto.randomUUID()
            return true
        } catch (error) {
            console.error(`Error submitting ${subject} report:`, error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('toast.reports.submitFailed'),
                description:
                    error instanceof z.ZodError
                        ? error.issues.map((e) => e.message).join(', ')
                        : t('toast.reports.unknownError'),
                color: 'error',
            })
            return false
        }
    }

    return {
        schema,
        state,
        submit,
    }
}

export const useItemReport = (itemId: Item['id']) =>
    useReport('item', async (state, idempotencyKey) => {
        await $fetch('/api/reports/item', {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: {
                itemId,
                nameError: state.reportReason.includes('nameError'),
                irrelevant: state.reportReason.includes('irrelevant'),
                other: state.reportReason.includes('other'),
                comment: state.comment,
            },
        })
    })

const submitContentReport = (
    subject: 'setup' | 'user',
    id: string,
    state: ReportState,
    idempotencyKey: string,
) =>
    $fetch(`/api/reports/${subject}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
            ...(subject === 'setup' ? { setupId: id } : { reporteeId: id }),
            spam: state.reportReason.includes('spam'),
            hate: state.reportReason.includes('hate'),
            infringe: state.reportReason.includes('infringe'),
            badImage: state.reportReason.includes('badImage'),
            other: state.reportReason.includes('other'),
            comment: state.comment,
        },
    })

export const useSetupReport = (setupId: Setup['id']) =>
    useReport('setup', (state, idempotencyKey) =>
        submitContentReport('setup', setupId, state, idempotencyKey),
    )

export const useUserReport = (userId: User['id']) =>
    useReport('user', (state, idempotencyKey) =>
        submitContentReport('user', userId, state, idempotencyKey),
    )
