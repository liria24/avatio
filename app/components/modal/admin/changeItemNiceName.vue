<script lang="ts" setup>
interface Props {
    itemId: string
    current: string
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const toast = useToast()

const input = ref(props.current)

const changeItemNiceName = async () => {
    try {
        await $fetch(`/api/items/${props.itemId}`, {
            method: 'PUT',
            body: { niceName: input.value },
        })
        toast.add({
            title: 'アイテムの名称を変更しました',
            color: 'success',
        })
        emit('close')
    } catch (error) {
        console.error('Failed to change item nice name:', error)
        toast.add({
            title: 'アイテムの名称の変更に失敗しました',
            color: 'error',
        })
    } finally {
        input.value = ''
    }
}
</script>

<template>
    <UModal title="Nice Name を変更">
        <template #body>
            <div class="flex flex-col gap-4">
                <UFormField label="新しい名称">
                    <UInput v-model="input" class="w-full" />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end">
                <UButton
                    loading-auto
                    label="変更"
                    color="neutral"
                    @click="changeItemNiceName()"
                />
            </div>
        </template>
    </UModal>
</template>
