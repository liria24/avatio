<script lang="ts" setup>
import { z } from 'zod/v4'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ setupId: number }>()

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

        await $fetch('/api/report/setup', {
            method: 'POST',
            body: {
                setupId: props.setupId,
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
    <UModal v-model:open="open" title="セットアップの報告">
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
                                label: 'スパム、個人情報、不適切な内容',
                                description:
                                    '荒らし目的で類似の投稿を複数回行っている、投稿内容に自身および他者の個人情報を含んでいる、その他不適切な内容を含んでいる。',
                                value: 'spam',
                            },
                            {
                                label: '差別、暴力、誹謗中傷',
                                description:
                                    '人種、性別、宗教、性的指向、障害、疾病、年齢、その他の属性に基づく差別的な表現、暴力的な表現などが含まれている。',
                                value: 'hate',
                            },
                            {
                                label: '他者への権利侵害',
                                description:
                                    '自身および第三者の著作権、商標権、肖像権、またはその他の権利侵害が予想される。',
                                value: 'infringe',
                            },
                            {
                                label: '過激な画像',
                                description:
                                    '過度な露出、暴力表現などを含む画像を添付している\nNSFWタグが付いている投稿であっても、過激な画像を添付することは禁止されています。',
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
