<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const toast = useToast()

const deleteSetup = async () => {
    try {
        await $fetch(`/api/setups/${props.setupId}`, {
            method: 'DELETE',
        })
        emit('close')
        toast.add({
            title: 'セットアップが削除されました',
            description: 'セットアップが正常に削除されました。',
            color: 'success',
        })
        navigateTo('/?cache=false')
    } catch (error) {
        toast.add({
            title: 'セットアップの削除に失敗しました',
            description:
                error instanceof Error
                    ? error.message
                    : '不明なエラーが発生しました',
            color: 'error',
        })
    }
}
</script>

<template>
    <UModal title="セットアップを削除">
        <template #body>
            <UAlert
                icon="lucide:trash"
                title="本当に削除しますか？"
                description="この操作は取り消すことができません。"
                color="warning"
                variant="subtle"
            />
        </template>

        <template #footer>
            <UButton
                loading-auto
                label="削除"
                color="error"
                size="lg"
                block
                @click="deleteSetup"
            />
        </template>
    </UModal>
</template>
