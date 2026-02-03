<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { deleteSetup: deleteSetupAction } = useAdminActions()

const deleteSetup = async () => {
    const success = await deleteSetupAction(props.setupId)
    if (success) {
        emit('close')
        navigateTo('/')
    }
}
</script>

<template>
    <UModal title="セットアップを削除">
        <template #body>
            <UAlert
                icon="mingcute:delete-2-fill"
                title="本当に削除しますか？"
                description="この操作は取り消すことができません。"
                color="warning"
                variant="subtle"
            />
        </template>

        <template #footer>
            <UButton loading-auto label="削除" color="error" size="lg" block @click="deleteSetup" />
        </template>
    </UModal>
</template>
