<script lang="ts" setup>
import { z } from 'zod'

const props = defineProps<{ itemId: string }>()

const emit = defineEmits(['close'])

const toast = useToast()

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

        await $fetch('/api/reports/item', {
            method: 'POST',
            body: {
                itemId: props.itemId,
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
        emit('close')
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
    <UModal title="アイテムの報告">
        <slot />

        <template #body>
            <UForm
                :state
                :schema
                class="flex w-full flex-col items-center gap-4 overflow-y-auto"
                @submit="Submit"
            >
                <UFormField name="reportReason" label="報告の理由" class="w-full">
                    <UCheckboxGroup
                        v-model="state.reportReason"
                        variant="table"
                        :items="[
                            {
                                label: 'アイテム名称の誤り',
                                description:
                                    'アイテムの名称が誤っている、ニュアンスが異なっている、または不適切である。',
                                value: 'nameError',
                            },
                            {
                                label: '無関係なアイテム',
                                description: 'アイテムが VR アバターに関連していない。',
                                value: 'irrelevant',
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

                <UFormField name="comment" label="報告の詳細や背景情報" class="w-full">
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
                <UButton loading-auto label="報告" color="neutral" size="lg" @click="Submit()" />
            </div>
        </template>
    </UModal>
</template>
