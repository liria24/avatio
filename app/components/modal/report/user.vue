<script lang="ts" setup>
import { z } from 'zod/v4'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ userId: string }>()

const toast = useToast()

const submitting = ref(false)

const schema = z
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
type Schema = z.infer<typeof schema>
const state = reactive<Schema>({
    reportReason: [],
    comment: '',
})

const Submit = async () => {
    try {
        await schema.parseAsync(state)

        await $fetch('/api/reports/user', {
            method: 'POST',
            body: {
                reporteeId: props.userId,
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

        submitting.value = false
        open.value = false
        state.reportReason = []
        state.comment = ''
    } catch (error) {
        toast.add({
            title: '報告の送信に失敗しました',
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
    <UModal v-model:open="open" title="ユーザーの報告">
        <slot />

        <template #body>
            <UForm
                :state
                :schema
                class="flex w-full flex-col items-center gap-4 overflow-y-auto"
                @submit="Submit"
            >
                <UFormField
                    name="reportReason"
                    label="報告の理由"
                    class="w-full"
                >
                    <UCheckboxGroup
                        v-model="state.reportReason"
                        variant="table"
                        :items="[
                            {
                                label: 'スパム',
                                description: 'スパムの投稿を含む。',
                                value: 'spam',
                            },
                            {
                                label: '悪意のあるユーザー',
                                description:
                                    'ヘイト、差別、脅迫など悪意のある内容を投稿している。',
                                value: 'hate',
                            },
                            {
                                label: '権利侵害',
                                description:
                                    '他者の権利を侵している、または権利侵害を助長している。',
                                value: 'infringe',
                            },
                            {
                                label: '不適切な画像',
                                description: '不適切なアイコンなどを含む。',
                                value: 'badImage',
                            },
                            {
                                label: 'その他',
                                description: 'その他の理由で報告',
                                value: 'other',
                            },
                        ]"
                        class="w-full"
                    />
                </UFormField>

                <UFormField
                    name="comment"
                    label="報告の詳細や背景情報"
                    class="w-full"
                >
                    <UTextarea
                        v-model="state.comment"
                        autoresize
                        placeholder="その他の理由を入力"
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

                <USeparator />

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
            </UForm>
        </template>
    </UModal>
</template>
