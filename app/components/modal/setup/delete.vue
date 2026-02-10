<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])
const localePath = useLocalePath()

const { deleteSetup: deleteSetupAction } = useAdminActions()

const deleteSetup = async () => {
    const success = await deleteSetupAction(props.setupId)
    if (success) {
        emit('close')
        navigateTo(localePath('/'))
    }
}
</script>

<template>
    <UModal :title="$t('modal.deleteSetup.title')">
        <template #body>
            <UAlert
                icon="mingcute:delete-2-fill"
                :title="$t('modal.deleteSetup.confirm')"
                :description="$t('modal.deleteSetup.description')"
                color="warning"
                variant="subtle"
            />
        </template>

        <template #footer>
            <UButton
                loading-auto
                :label="$t('delete')"
                color="error"
                size="lg"
                block
                @click="deleteSetup"
            />
        </template>
    </UModal>
</template>
