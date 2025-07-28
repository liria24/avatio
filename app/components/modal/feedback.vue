<script lang="ts" setup>
import { z } from 'zod'

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const route = useRoute()

const submitting = ref(false)

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

        submitting.value = true

        await $fetch('/api/feedbacks', {
            method: 'POST',
            body: {
                comment: state.comment,
                contextPath: route.fullPath,
            },
        })
        toast.add({
            title: 'フィードバックが送信されました',
            description: 'ご協力ありがとうございます。',
            color: 'success',
        })

        open.value = false
        state.comment = ''
    } catch (error) {
        toast.add({
            title: 'フィードバックの送信に失敗しました',
            description:
                error instanceof z.ZodError
                    ? error.issues.map((e) => e.message).join(', ')
                    : '不明なエラーが発生しました',
            color: 'error',
        })
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <UModal v-model:open="open" title="フィードバック">
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
                        placeholder="フィードバックを入力"
                        class="w-full"
                    />

                    <template #hint>
                        <UTooltip
                            text="Markdownをサポートしています"
                            :content="{ side: 'top' }"
                            :delay-duration="50"
                        >
                            <Icon
                                name="simple-icons:markdown"
                                size="20"
                                class="text-dimmed -my-1 mr-0.5"
                            />
                        </UTooltip>
                    </template>
                </UFormField>

                <UAlert
                    icon="lucide:info"
                    title="フィードバックは匿名で送信されます"
                    variant="subtle"
                />
            </UForm>
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-1.5">
                <UButton
                    :disabled="submitting"
                    label="キャンセル"
                    variant="ghost"
                    @click="open = false"
                />
                <UButton
                    :loading="submitting"
                    label="報告"
                    color="neutral"
                    @click="Submit()"
                />
            </div>
        </template>
    </UModal>
</template>
