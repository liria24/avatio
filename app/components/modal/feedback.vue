<script lang="ts" setup>
import { z } from 'zod'

const emit = defineEmits(['close'])

const route = useRoute()
const { submitFeedback } = useAdminActions()

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
            title: 'フィードバックの送信に失敗しました',
            description:
                error instanceof z.ZodError
                    ? error.issues.map((e) => e.message).join(', ')
                    : '不明なエラーが発生しました',
            color: 'error',
        })
    }
}
</script>

<template>
    <UModal
        title="フィードバック"
        description="ご意見をお聞かせください。フィードバックは匿名で送信されます。"
    >
        <slot />

        <template #body>
            <UForm
                :state
                :schema
                class="flex w-full flex-col items-center gap-4 overflow-y-auto"
                @submit="Submit"
            >
                <UFormField name="comment" label="コメント" class="w-full">
                    <UTextarea
                        v-model="state.comment"
                        autoresize
                        placeholder="ご意見・ご要望・不具合報告など、ご自由にお書きください。"
                        class="w-full"
                    />

                    <template #hint>
                        <UTooltip
                            text="Markdownをサポートしています"
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
                <UButton loading-auto label="送信" color="neutral" @click="Submit()" />
            </div>
        </template>
    </UModal>
</template>
