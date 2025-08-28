<script lang="ts" setup>
const emit = defineEmits(['close'])

const route = useRoute()
const localePath = useLocalePath()
const { $login } = useNuxtApp()

const isInternalUpdate = ref(false)
const signingIn = ref(false)

const handleLogin = (provider: 'twitter') => {
    signingIn.value = true
    $login(provider)
}

// ブラウザの戻るボタンでモーダルを閉じる
const handlePopState = () => {
    if (route.path === localePath('/login')) {
        isInternalUpdate.value = true
        emit('close')
        nextTick(() => {
            isInternalUpdate.value = false
        })
    }
}

onMounted(() => {
    // ブラウザの戻るボタンのイベントリスナーを追加
    window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
    // イベントリスナーを削除
    if (import.meta.client)
        window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
    <UModal title="ログイン">
        <slot />

        <template #body>
            <div class="flex flex-col gap-2">
                <UButton
                    :loading="signingIn"
                    label="X (Twitter) で続行"
                    icon="simple-icons:x"
                    block
                    size="lg"
                    variant="subtle"
                    color="neutral"
                    @click="handleLogin('twitter')"
                />
            </div>
        </template>

        <template #footer>
            <div class="flex items-center gap-3">
                <UButton
                    :to="localePath('/terms')"
                    target="_blank"
                    label="利用規約"
                    variant="link"
                    size="sm"
                    color="neutral"
                    class="p-0"
                />
                <UButton
                    :to="localePath('/privacy-policy')"
                    target="_blank"
                    label="プライバシー"
                    variant="link"
                    size="sm"
                    color="neutral"
                    class="p-0"
                />
            </div>
        </template>
    </UModal>
</template>
