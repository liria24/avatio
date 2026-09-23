<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

interface Props {
    callbackURL?: string
}
const { callbackURL } = defineProps<Props>()

const route = useRoute()
const localePath = useLocalePath()

// ブラウザの戻るボタンでモーダルを閉じる
const handlePopState = () => {
    if (route.path === localePath('/login')) open.value = false
}

useEventListener('popstate', handlePopState)
</script>

<template>
    <UModal
        v-model:open="open"
        :ui="{
            content: 'max-w-xl px-4 py-8 sm:p-10 rounded-2xl divide-y-0',
            close: 'sm:top-6 sm:right-6',
        }"
    >
        <slot />

        <template #content>
            <UButton
                :aria-label="$t('close')"
                icon="mingcute:close-line"
                variant="ghost"
                class="absolute top-4 right-4"
                @click="open = false"
            />

            <UserLogin :callbackURL />
        </template>
    </UModal>
</template>
