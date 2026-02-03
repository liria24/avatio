<script lang="ts" setup>
const props = defineProps<{ setupId: number }>()

const emit = defineEmits(['close'])

const { schema, state, submit } = useSetupReport(props.setupId)

const Submit = async () => {
    const success = await submit()
    if (success) {
        emit('close')
    }
}
</script>

<template>
    <UModal title="セットアップの報告">
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
