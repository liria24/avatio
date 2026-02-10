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
    <UModal :title="$t('admin.modal.changeItemNiceName.title')">
        <template #body>
            <div class="flex flex-col gap-4">
                <UFormField :label="$t('admin.modal.changeItemNiceName.newName')">
                    <UInput v-model="input" class="w-full" />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end">
                <UButton
                    loading-auto
                    :label="$t('admin.modal.changeItemNiceName.button')"
                    color="neutral"
                    @click="changeItemNiceName()"
                />
            </div>
        </template>
    </UModal>
</template>
