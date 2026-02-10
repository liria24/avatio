<script lang="ts" setup>
import { z } from 'zod'

const emit = defineEmits(['close'])

const route = useRoute()
const { submitFeedback } = useAdminActions()
const { t } = useI18n()

const schema = z.object({
    comment: z.string(),
})
type Schema = z.infer<typeof schema>
const state = reactive<Schema>({
    comment: '',
})

const Submit = async () => {
    try {
        await schema.parseAsync(state)

        const success = await submitFeedback(state.comment, route.fullPath)
        if (!success) return

        emit('close')
        state.comment = ''
    } catch (error) {
        const toast = useToast()
        toast.add({
            title: t('modal.feedback.submitted'),
            description:
                error instanceof z.ZodError
                    ? error.issues.map((e) => e.message).join(', ')
                    : t('errors.generic'),
            color: 'error',
        })
    }
}
</script>

<template>
    <UModal
        :title="$t('modal.feedback.title')"
        :description="$t('footer.links.feedbackDescription')"
    >
        <slot />

        <template #body>
            <UForm
                :state
                :schema
                class="flex w-full flex-col items-center gap-4 overflow-y-auto"
                @submit="Submit"
            >
                <UFormField name="comment" :label="$t('modal.feedback.comment')" class="w-full">
                    <UTextarea
                        v-model="state.comment"
                        autoresize
                        :placeholder="$t('modal.feedback.placeholder')"
                        class="w-full"
                    />

                    <template #hint>
                        <UTooltip
                            :text="$t('modal.markdownSupported')"
                            :content="{ side: 'top' }"
                            :delay-duration="50"
                        >
                            <Icon
                                name="mingcute:markdown-fill"
                                size="20"
                                class="text-dimmed -my-1 mr-0.5"
                            />
                        </UTooltip>
                    </template>
                </UFormField>
            </UForm>
        </template>

        <template #footer>
            <div class="flex w-full justify-end">
                <UButton loading-auto :label="$t('submit')" color="neutral" @click="Submit()" />
            </div>
        </template>
    </UModal>
</template>
