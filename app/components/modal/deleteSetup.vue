<script lang="ts" setup>
const props = defineProps<{
    id: number
}>()

const vis = defineModel<boolean>({
    default: false,
})

const onDelete = () => {
    useDeleteSetup(props.id)
    vis.value = false
}
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <UiTitle label="セットアップ削除" icon="lucide:trash" />
        </template>

        <span
            class="text-md w-full text-center font-normal text-zinc-800 dark:text-zinc-100"
        >
            セットアップを削除します。<br />
            この操作は取り消せません。よろしいですか？
        </span>

        <template #footer>
            <div class="flex items-center justify-end gap-2">
                <Button
                    label="削除"
                    class="text-red-500 hover:bg-red-500 hover:text-white hover:outline-red-400 dark:text-red-400 hover:dark:bg-red-800 hover:dark:text-white hover:dark:outline-red-700"
                    @click="onDelete"
                />
                <Button label="キャンセル" @click="vis = false" />
            </div>
        </template>
    </Modal>
</template>
