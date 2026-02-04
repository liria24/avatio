<script lang="ts" setup>
const props = defineProps<{ itemId: string }>()

const emit = defineEmits(['close'])

const { schema, state, submit } = useItemReport(props.itemId)

const Submit = async () => {
    const success = await submit()
    if (success) {
        emit('close')
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
