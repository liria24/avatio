<script lang="ts" setup>
const emit = defineEmits(['close'])

const { state, schema, submit } = useFeedback()
</script>

<template>
    <UModal
        :title="$t('modal.feedback.title')"
        :description="$t('footer.links.feedbackDescription')"
        :ui="{
            header: 'p-4 sm:p-4 min-h-0',
            body: 'p-4 sm:p-4',
            footer: 'p-4 sm:p-4',
            content: 'max-w-xl p-4 sm:p-8 rounded-2xl divide-y-0',
            close: 'sm:top-6 sm:right-6',
        }"
    >
        <slot />

        <template #body>
            <UForm
                :state
                :schema
                class="flex w-full scrollbar-thin flex-col items-center gap-4 overflow-y-auto"
                @submit="submit"
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
                <UButton
                    loading-auto
                    :label="$t('submit')"
                    color="neutral"
                    size="lg"
                    @click="submit()"
                />
            </div>
        </template>
    </UModal>
</template>
