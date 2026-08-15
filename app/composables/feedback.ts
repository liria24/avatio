import { z } from 'zod'

export const useFeedback = () => {
    const route = useRoute()
    const toast = useToast()
    const { t } = useI18n()

    const schema = z.object({
        comment: z.string(),
    })
    type Schema = z.infer<typeof schema>
    const state = useState<Schema>('feedbackState', () => ({
        comment: '',
    }))
    let idempotencyKey = crypto.randomUUID()

    const submit = async () => {
        try {
            await schema.parseAsync(state.value)

            await $fetch('/api/feedbacks', {
                method: 'POST',
                headers: { 'Idempotency-Key': idempotencyKey },
                body: {
                    comment: state.value.comment,
                    contextPath: route.fullPath,
                },
            })
            toast.add({
                icon: 'mingcute:check-line',
                title: t('toast.admin.feedbackSubmitted'),
                description: t('toast.admin.feedbackSubmittedDescription'),
                color: 'success',
            })

            state.value.comment = ''
            idempotencyKey = crypto.randomUUID()
        } catch (error) {
            console.error('Error submitting feedback:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('toast.admin.feedbackSubmitFailed'),
                color: 'error',
            })
        }
    }

    return {
        schema,
        state,
        submit,
    }
}
