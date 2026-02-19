<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

interface Props {
    username: string
}
const { username } = defineProps<Props>()

const { mute } = useUserMute(username)

const isInternalUpdate = ref(false)

const handlePopState = () => {
    isInternalUpdate.value = true
    open.value = false
    nextTick(() => {
        isInternalUpdate.value = false
    })
}

const handleMute = () => {
    mute()
    open.value = false
}

onMounted(() => {
    window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
    if (import.meta.client) window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
    <UModal
        v-model:open="open"
        title="ユーザーをミュートしますか？"
        :ui="{
            header: 'p-4 sm:p-4 min-h-0',
            body: 'p-4 sm:p-4',
            footer: 'p-4 sm:p-4',
            content: 'max-w-xl p-4 sm:p-8 rounded-2xl divide-y-0',
            close: 'sm:top-6 sm:right-6',
        }"
    >
        <slot />

        <template #body>
            <div>
                <p class="text-sm text-zinc-500">
                    ミュートしたユーザーの投稿はタイムラインに表示されなくなり、通知も届かなくなります。
                </p>
            </div>
        </template>

        <template #footer>
            <UButton
                label="ミュート"
                color="neutral"
                size="lg"
                block
                class="rounded-lg"
                @click="handleMute()"
            />
        </template>
    </UModal>
</template>
