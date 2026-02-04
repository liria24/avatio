<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { getSession } = useAuth()
const session = await getSession()
const toast = useToast()
const { unhideSetup: unhideSetupAction } = useAdminActions()

const unhideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: '権限がありません',
            description: 'Admin アカウントでログインしてください。',
            color: 'error',
        })
        return
    }

    const success = await unhideSetupAction(props.setupId)
    if (success) emit('close')
}
</script>

<template>
    <UModal title="セットアップを再表示">
        <template #body>
            <UAlert
                icon="mingcute:eye-2-fill"
                title="これは Admin アクションです"
                description="セットアップは再表示され、ユーザーに見えるようになります。"
                color="info"
                variant="subtle"
            />
        </template>
        <template #footer>
            <UButton label="再表示する" color="neutral" size="lg" block @click="unhideSetup" />
        </template>
    </UModal>
</template>
