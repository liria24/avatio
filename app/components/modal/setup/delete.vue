<script setup lang="ts">
interface Props {
    setupId: Setup['id']
}
const { setupId } = defineProps<Props>()

const emit = defineEmits(['close'])
const localePath = useLocalePath()

const { deleteSetup: deleteSetupAction } = useDeleteSetup(setupId)

const deleteSetup = async () => {
    await deleteSetupAction()
    emit('close')
    navigateTo(localePath('/'))
}
</script>

<template>
    <UModal
        :title="$t('modal.deleteSetup.confirm')"
        :ui="{
            header: 'p-4 sm:p-4 min-h-0',
            body: 'p-4 sm:p-4',
            footer: 'p-4 sm:p-4',
            content: 'max-w-xl p-4 sm:p-8 rounded-2xl divide-y-0',
            close: 'sm:top-6 sm:right-6',
        }"
    >
        <template #body>
            <UAlert
                icon="mingcute:alert-diamond-fill"
                :description="$t('modal.deleteSetup.description')"
                color="warning"
                variant="outline"
            />
        </template>

        <template #footer>
            <UButton
                loading-auto
                :label="$t('delete')"
                color="error"
                variant="subtle"
                size="lg"
                block
                @click="deleteSetup"
            />
        </template>
    </UModal>
</template>
