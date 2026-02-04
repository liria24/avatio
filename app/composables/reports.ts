import { z } from 'zod'

const createReportSchema = () =>
    z
        .object({
            reportReason: z.string().array().min(1, '報告の理由を選択してください'),
            comment: z.string().optional(),
        })
        .refine(
            (data) => {
                if (data.reportReason.includes('other'))
                    return data.comment && data.comment.trim().length > 0
                return true
            },
            {
                message: 'その他を選択した場合は詳細を入力してください',
                path: ['comment'],
            }
        )

type ReportState = {
    reportReason: string[]
    comment?: string
}

export const useItemReport = (itemId: string) => {
    const toast = useToast()
    const schema = createReportSchema()
    const state = reactive<ReportState>({
        reportReason: [],
        comment: '',
    })

    const submit = async () => {
        try {
            await schema.parseAsync(state)

            await $fetch('/api/reports/item', {
                method: 'POST',
                body: {
                    itemId,
                    nameError: state.reportReason.includes('nameError'),
                    irrelevant: state.reportReason.includes('irrelevant'),
                    other: state.reportReason.includes('other'),
                    comment: state.comment,
                },
            })

            toast.add({
                title: '報告が送信されました',
                description: 'ご協力ありがとうございます。',
                color: 'success',
            })

            state.reportReason = []
            state.comment = ''
            return true
        } catch (error) {
            console.error('Error submitting item report:', error)
            toast.add({
                title: '報告の送信に失敗しました',
                description:
                    error instanceof z.ZodError
                        ? error.issues.map((e) => e.message).join(', ')
                        : '不明なエラーが発生しました',
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

export const useSetupReport = (setupId: number) => {
    const toast = useToast()
    const schema = createReportSchema()
    const state = reactive<ReportState>({
        reportReason: [],
        comment: '',
    })

    const submit = async () => {
        try {
            await schema.parseAsync(state)

            await $fetch('/api/reports/setup', {
                method: 'POST',
                body: {
                    setupId,
                    spam: state.reportReason.includes('spam'),
                    hate: state.reportReason.includes('hate'),
                    infringe: state.reportReason.includes('infringe'),
                    badImage: state.reportReason.includes('badImage'),
                    other: state.reportReason.includes('other'),
                    comment: state.comment,
                },
            })

            toast.add({
                title: '報告が送信されました',
                description: 'ご協力ありがとうございます。',
                color: 'success',
            })

            state.reportReason = []
            state.comment = ''
            return true
        } catch (error) {
            console.error('Error submitting setup report:', error)
            toast.add({
                title: '報告の送信に失敗しました',
                description:
                    error instanceof z.ZodError
                        ? error.issues.map((e) => e.message).join(', ')
                        : '不明なエラーが発生しました',
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

export const useUserReport = (userId: string) => {
    const toast = useToast()
    const schema = createReportSchema()
    const state = reactive<ReportState>({
        reportReason: [],
        comment: '',
    })

    const submit = async () => {
        try {
            await schema.parseAsync(state)

            await $fetch('/api/reports/user', {
                method: 'POST',
                body: {
                    reporteeId: userId,
                    spam: state.reportReason.includes('spam'),
                    hate: state.reportReason.includes('hate'),
                    infringe: state.reportReason.includes('infringe'),
                    badImage: state.reportReason.includes('badImage'),
                    other: state.reportReason.includes('other'),
                    comment: state.comment,
                },
            })

            toast.add({
                title: '報告が送信されました',
                description: 'ご協力ありがとうございます。',
                color: 'success',
            })

            state.reportReason = []
            state.comment = ''
            return true
        } catch (error) {
            console.error('Error submitting user report:', error)
            toast.add({
                title: '報告の送信に失敗しました',
                description:
                    error instanceof z.ZodError
                        ? error.issues.map((e) => e.message).join(', ')
                        : '不明なエラーが発生しました',
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
