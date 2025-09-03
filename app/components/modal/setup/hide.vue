<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { $session } = useNuxtApp()
const session = await $session()
const toast = useToast()

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

    try {
        await $fetch(`/api/admin/setup/${props.setupId}`, {
            method: 'PATCH',
            body: {
                hide: true,
                hideReason: hideReason.value.length
                    ? hideReason.value
                    : undefined,
            },
        })
        toast.add({
            title: 'セットアップが非表示になりました',
            color: 'success',
        })
        hideReason.value = ''
        emit('close')
    } catch (error) {
        console.error('セットアップの非表示に失敗:', error)
        toast.add({
            title: 'セットアップの非表示に失敗しました',
            color: 'error',
        })
    }
}
</script>

<template>
    <UModal title="セットアップを非表示">
        <template #body>
            <div class="flex flex-col gap-2">
                <UAlert
                    icon="lucide:eye-off"
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
