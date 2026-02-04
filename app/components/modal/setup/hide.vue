<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { getSession } = useAuth()
const session = await getSession()
const toast = useToast()
const { hideSetup: hideSetupAction } = useAdminActions()

const hideReason = ref('')

const hideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: '権限がありません',
            description: 'Admin アカウントでログインしてください。',
            color: 'error',
        })
        return
    }

    const success = await hideSetupAction(props.setupId, hideReason.value)
    if (success) {
        hideReason.value = ''
        emit('close')
    }
}
</script>

<template>
    <UModal title="セットアップを非表示">
        <template #body>
            <div class="flex flex-col gap-2">
                <UAlert
                    icon="mingcute:eye-close-fill"
                    title="これは Admin アクションです"
                    description="セットアップは非表示になり、再度表示するまでユーザーには見えなくなります。"
                    color="warning"
                    variant="subtle"
                />
                <UFormField label="理由" required>
                    <UTextarea v-model="hideReason" autoresize class="w-full" />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <UButton
                :disabled="!hideReason.length"
                label="非表示にする"
                color="neutral"
                size="lg"
                block
                @click="hideSetup"
            />
        </template>
    </UModal>
</template>
