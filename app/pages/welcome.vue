<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
    layout: 'minimal',
})

const { $session } = useNuxtApp()
const session = await $session()
const toast = useToast()

const input = ref<string>(session.value?.user.username || '')
const available = ref<boolean>(false)

const updateId = async (username: string) => {
    try {
        await $fetch(session.value!.user.username!, {
            baseURL: '/api/users/',
            method: 'PUT',
            body: { username },
        })
        toast.add({
            title: 'ユーザーIDが変更されました',
            description: 'ページを更新しています...',
            progress: false,
        })
        await navigateTo('/', { external: true })
    } catch (error) {
        console.error('Error updating user ID:', error)
        toast.add({
            title: 'ユーザーIDの変更に失敗しました',
            description: 'ユーザーIDの変更中にエラーが発生しました。',
            color: 'error',
        })
    }
}

defineSeo({
    title: 'Avatioにようこそ！',
})
</script>

<template>
    <div class="flex flex-col items-center gap-6">
        <h1 class="text-2xl font-medium text-nowrap">Avatioにようこそ！</h1>

        <InputUsername v-model="input" v-model:available="available" />

        <UButton
            label="ユーザーIDを変更"
            color="neutral"
            variant="solid"
            size="lg"
            :disabled="!available"
            loading-auto
            @click="updateId(input)"
        />
    </div>
</template>
