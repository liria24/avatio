<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

const route = useRoute()
const localePath = useLocalePath()

const isInternalUpdate = ref(false)

// ブラウザの戻るボタンでモーダルを閉じる
const handlePopState = () => {
    if (route.path === localePath('/login')) {
        isInternalUpdate.value = true
        open.value = false
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
    <UModal v-model:open="open" :ui="{ content: 'max-w-xl p-10 rounded-2xl divide-y-0' }">
        <slot />

        <template #content>
            <UButton
                :aria-label="$t('close')"
                icon="mingcute:close-line"
                variant="ghost"
                class="absolute top-4 right-4"
                @click="open = false"
            />

            <UserLogin />
        </template>
    </UModal>
</template>
