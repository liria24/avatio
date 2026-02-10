<script lang="ts" setup>
const props = defineProps<{ setupId: number }>()

const emit = defineEmits(['close'])

const { t } = useI18n()
const { schema, state, submit } = useSetupReport(props.setupId)

const reasonItems = computed(() => [
    {
        label: t('modal.report.setup.reasons.spam.label'),
        description: t('modal.report.setup.reasons.spam.description'),
        value: 'spam',
    },
    {
        label: t('modal.report.setup.reasons.hate.label'),
        description: t('modal.report.setup.reasons.hate.description'),
        value: 'hate',
    },
    {
        label: t('modal.report.setup.reasons.infringe.label'),
        description: t('modal.report.setup.reasons.infringe.description'),
        value: 'infringe',
    },
    {
        label: t('modal.report.setup.reasons.badImage.label'),
        description: t('modal.report.setup.reasons.badImage.description'),
        value: 'badImage',
    },
    {
        label: t('modal.report.setup.reasons.other.label'),
        description: t('modal.report.setup.reasons.other.description'),
        value: 'other',
    },
])

const Submit = async () => {
    const success = await submit()
    if (success) {
        emit('close')
    }
}
</script>

<template>
    <UModal :title="$t('modal.report.setup.title')">
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
                    :label="$t('modal.report.setup.reason')"
                    class="w-full"
                >
                    <UCheckboxGroup
                        v-model="state.reportReason"
                        variant="table"
                        :items="reasonItems"
                        class="w-full"
                    />
                </UFormField>

                <UFormField name="comment" :label="$t('modal.report.setup.comment')" class="w-full">
                    <UTextarea
                        v-model="state.comment"
                        autoresize
                        :placeholder="$t('modal.report.setup.commentPlaceholder')"
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
                <UButton
                    loading-auto
                    :label="$t('report')"
                    color="neutral"
                    size="lg"
                    @click="Submit()"
                />
            </div>
        </template>
    </UModal>
</template>
