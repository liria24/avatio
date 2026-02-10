<script lang="ts" setup>
interface Props {
    userId: string
    name: string
    image?: string | null
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { banUserWithReason } = useAdminActions()

const banReasonInput = ref('')
const banExpiresInInput = ref(0)

const banUser = async () => {
    const success = await banUserWithReason(
        props.userId,
        banReasonInput.value,
        banExpiresInInput.value || undefined
    )
    if (success) {
        emit('close')
        banReasonInput.value = ''
        banExpiresInInput.value = 0
    }
}
</script>

<template>
    <UModal :title="$t('admin.modal.banUser.title')">
        <template #body>
            <div class="flex flex-col gap-4">
                <UUser
                    :name="props.name"
                    :description="`@${props.userId}`"
                    :avatar="{
                        src: props.image || undefined,
                        icon: 'mingcute:user-3-fill',
                    }"
                />

                <UFormField :label="$t('admin.modal.banUser.reason')">
                    <UTextarea
                        v-model="banReasonInput"
                        :placeholder="$t('admin.modal.banUser.reasonPlaceholder')"
                        autoresize
                        class="w-full"
                    />
                </UFormField>
                <UFormField :label="$t('admin.modal.banUser.duration')">
                    <UInputNumber
                        v-model="banExpiresInInput"
                        :placeholder="$t('admin.modal.banUser.durationPlaceholder')"
                        class="w-full"
                    />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end">
                <UButton
                    loading-auto
                    :label="$t('admin.modal.banUser.button')"
                    color="error"
                    variant="subtle"
                    @click="banUser()"
                />
            </div>
        </template>
    </UModal>
</template>
