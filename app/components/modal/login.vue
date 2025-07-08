<script lang="ts" setup>
const route = useRoute()
const localePath = useLocalePath()
const { $login } = useNuxtApp()

const open = ref(false)
const originalPath = ref(route.path)
const currentPath = ref(route.path)
const isInternalUpdate = ref(false)
const signingIn = ref(false)

const handleLogin = (provider: 'twitter') => {
    signingIn.value = true
    $login(provider)
}

// ブラウザの戻るボタンでモーダルを閉じる
const handlePopState = () => {
    if (open.value && route.path === localePath('/login')) {
        isInternalUpdate.value = true
        open.value = false
        nextTick(() => {
            isInternalUpdate.value = false
        })
    }
}

// モーダルの開閉に応じてパスを変更
watch(open, (value) => {
    signingIn.value = false

    if (isInternalUpdate.value) return

    if (value) {
        // モーダルを開く時：元のパスを保存してログインページに移動
        originalPath.value = route.path
        isInternalUpdate.value = true
        currentPath.value = localePath('/login')
        window.history.pushState(null, '', localePath('/login'))
        nextTick(() => {
            isInternalUpdate.value = false
        })
    } else {
        if (currentPath.value === localePath('/login')) {
            // モーダルを閉じる時：元のパスに戻る
            isInternalUpdate.value = true
            currentPath.value = originalPath.value
            window.history.pushState(null, '', originalPath.value)
            nextTick(() => {
                isInternalUpdate.value = false
            })
        }
    }
})

// パスの変更を監視してモーダルの状態を同期
watch(currentPath, (newPath) => {
    if (isInternalUpdate.value) return

    if (newPath === localePath('/login') && !open.value) {
        isInternalUpdate.value = true
        open.value = true
        nextTick(() => {
            isInternalUpdate.value = false
        })
    } else if (newPath !== localePath('/login') && open.value) {
        isInternalUpdate.value = true
        open.value = false
        nextTick(() => {
            isInternalUpdate.value = false
        })
    }
})

onMounted(() => {
    // ブラウザの戻るボタンのイベントリスナーを追加
    window.addEventListener('popstate', handlePopState)
})

onUnmounted(() => {
    // イベントリスナーを削除
    window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
    <UModal v-model:open="open" title="ログイン">
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
