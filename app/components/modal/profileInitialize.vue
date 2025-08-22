<script lang="ts" setup>
const { $session } = useNuxtApp()
const session = await $session()
const toast = useToast()
const route = useRoute()

const open = defineModel<boolean>('open', {
    default: false,
})

const input = ref<string>(session.value?.user.id || '')
const available = ref<boolean>(false)
const updating = ref<boolean>(false)

const updateId = async (newId: string) => {
    updating.value = true

    try {
        await $fetch(session.value!.user.id, {
            baseURL: '/api/users/',
            method: 'PUT',
            body: { id: newId },
        })
        toast.add({
            title: 'ユーザーIDが変更されました',
            description: 'ページを更新しています...',
            progress: false,
        })
        await navigateTo(route.path, { external: true })
    } catch (error) {
        console.error('Error updating user ID:', error)
        toast.add({
            title: 'ユーザーIDの変更に失敗しました',
            description: 'ユーザーIDの変更中にエラーが発生しました。',
            color: 'error',
        })
    } finally {
        updating.value = false
    }
}

const close = async () => {
    try {
        await $fetch(session.value!.user.id, {
            baseURL: '/api/users/',
            method: 'PUT',
            body: { isInitialized: true },
        })
        open.value = false
    } catch (error) {
        console.error('Error setting initialization status:', error)
        toast.add({
            title: '初期化状態の設定に失敗しました',
            description: 'もう一度お試しください。',
            color: 'error',
        })
    }
}
</script>

<template>
    <UModal
        v-model:open="open"
        title="Avatio へようこそ！"
        :close="false"
        :dismissible="false"
    >
        <template #body>
            <InputUserId v-model="input" v-model:available="available" />
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-2">
                <UButton
                    :disabled="updating"
                    label="後で設定"
                    variant="ghost"
                    @click="close"
                />
                <UButton
                    :loading="updating"
                    :disabled="!available"
                    label="変更を保存"
                    color="neutral"
                    @click="updateId(input)"
                />
            </div>
        </template>
    </UModal>
</template>
