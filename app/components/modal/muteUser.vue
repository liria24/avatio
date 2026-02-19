<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

interface Props {
    username: string
}
const { username } = defineProps<Props>()

const isInternalUpdate = ref(false)

const handlePopState = () => {
    isInternalUpdate.value = true
    open.value = false
    nextTick(() => {
        isInternalUpdate.value = false
    })
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
        :ui="{ content: 'max-w-xl p-10 rounded-2xl divide-y-0' }"
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
            <UButton label="ミュート" color="neutral" size="lg" block />
        </template>
    </UModal>
</template>
