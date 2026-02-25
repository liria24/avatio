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

    const submit = async () => {
        try {
            await schema.parseAsync(state.value)

            await $fetch('/api/feedbacks', {
                method: 'POST',
                body: {
                    comment: state.value.comment,
                    contextPath: route.fullPath,
                },
            })
            toast.add({
                title: t('toast.admin.feedbackSubmitted'),
                description: t('toast.admin.feedbackSubmittedDescription'),
                color: 'success',
            })

            state.value.comment = ''
        } catch (error) {
            console.error('Error submitting feedback:', error)
            toast.add({
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
