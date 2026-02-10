<script lang="ts" setup>
const emit = defineEmits(['close'])

const route = useRoute()
const localePath = useLocalePath()
const { signIn } = useAuth()

const isInternalUpdate = ref(false)

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
    if (import.meta.client) window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
    <UModal :title="$t('modal.login.title')" :ui="{ content: 'max-w-xl' }">
        <slot />

        <template #body>
            <div class="flex flex-col gap-2">
                <UButton
                    loading-auto
                    label="X (Twitter)"
                    icon="mingcute:social-x-fill"
                    block
                    size="lg"
                    variant="subtle"
                    color="neutral"
                    class="py-4"
                    @click="signIn.twitter()"
                />
            </div>
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-3">
                <p class="text-muted text-right text-xs">{{ $t('modal.login.agreement') }}</p>
                <UButton
                    :to="localePath('/terms')"
                    target="_blank"
                    :label="$t('modal.login.footer.terms')"
                    variant="link"
                    size="sm"
                    color="neutral"
                    class="p-0"
                />
                <UButton
                    :to="localePath('/privacy-policy')"
                    target="_blank"
                    :label="$t('modal.login.footer.privacy')"
                    variant="link"
                    size="sm"
                    color="neutral"
                    class="p-0"
                />
            </div>
        </template>
    </UModal>
</template>
