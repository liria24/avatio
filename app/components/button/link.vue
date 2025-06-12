<script lang="ts" setup>
interface Props {
    link: string
}
const props = defineProps<Props>()

const modal = ref(false)
const isButtonEnabled = ref(false)

const data = getLinkInfo(props.link)

watch(modal, (newValue) => {
    if (newValue) {
        // モーダルが開いたとき
        isButtonEnabled.value = false
        setTimeout(() => {
            isButtonEnabled.value = true
        }, 1500)
    }
})
</script>

<template>
    <Button
        :tooltip="props.link"
        :aria-label="props.link"
        variant="flat"
        class="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 py-0"
        @click="modal = true"
    >
        <Icon
            :name="data.icon"
            :size="data.iconSize"
            class="bg-zinc-700 dark:bg-zinc-300"
        />
    </Button>

    <Modal v-model="modal">
        <template #header>
            <DialogTitle> 外部サイトに移動します </DialogTitle>
        </template>

        <p>リンクが安全かどうか必ず確認してください！</p>
        <span
            class="rounded-lg p-3 text-sm break-all ring-1 ring-zinc-400 dark:ring-zinc-600"
        >
            {{ props.link }}
        </span>

        <template #footer>
            <Button
                :to="props.link"
                :disabled="!isButtonEnabled"
                new-tab
                label="リンク先に移動"
                class="w-full"
            />
        </template>
    </Modal>
</template>
