<script lang="ts" setup>
interface Props {
    itemId: string
    current: string
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { changeItemNiceName: changeItemNiceNameAction } = useAdminActions()

const input = ref(props.current)

const changeItemNiceName = async () => {
    const success = await changeItemNiceNameAction(props.itemId, input.value)
    if (success) {
        emit('close')
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
                <UButton loading-auto label="変更" color="neutral" @click="changeItemNiceName()" />
            </div>
        </template>
    </UModal>
</template>
