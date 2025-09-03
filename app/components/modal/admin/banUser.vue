<script lang="ts" setup>
interface Props {
    userId: string
    name: string
    image?: string | null
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const toast = useToast()

const banReasonInput = ref('')
const banExpiresInInput = ref(0)

const banUser = async () => {
    try {
        await $fetch(`/api/admin/user/${props.userId}`, {
            method: 'PATCH',
            body: {
                ban: true,
                banReason: banReasonInput.value,
                banExpiresIn: banExpiresInInput.value || undefined,
            },
        })
        toast.add({
            title: 'ユーザーをBANしました',
            color: 'success',
        })
        emit('close')
    } catch (error) {
        console.error('Failed to ban user:', error)
        toast.add({
            title: 'ユーザーのBANに失敗しました',
            color: 'error',
        })
    } finally {
        banReasonInput.value = ''
        banExpiresInInput.value = 0
    }
}
</script>

<template>
    <UModal title="BAN">
        <template #body>
            <div class="flex flex-col gap-4">
                <UUser
                    :name="props.name"
                    :description="`@${props.userId}`"
                    :avatar="{
                        src: props.image || undefined,
                        icon: 'lucide:user-round',
                    }"
                />

                <UFormField label="理由">
                    <UTextarea
                        v-model="banReasonInput"
                        placeholder="理由を入力してください"
                        autoresize
                        class="w-full"
                    />
                </UFormField>
                <UFormField label="BAN 期間 (秒)">
                    <UInputNumber
                        v-model="banExpiresInInput"
                        placeholder="0 で無期限"
                        class="w-full"
                    />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end">
                <UButton
                    loading-auto
                    label="BAN"
                    color="error"
                    variant="subtle"
                    @click="banUser()"
                />
            </div>
        </template>
    </UModal>
</template>
