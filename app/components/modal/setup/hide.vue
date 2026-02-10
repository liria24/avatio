<script setup lang="ts">
interface Props {
    setupId: number
}
const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { t } = useI18n()
const { getSession } = useAuth()
const session = await getSession()
const toast = useToast()
const { hideSetup: hideSetupAction } = useAdminActions()

const hideReason = ref('')

const hideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: t('errors.unauthorized'),
            description: t('errors.adminRequired'),
            color: 'error',
        })
        return
    }

    const success = await hideSetupAction(props.setupId, hideReason.value)
    if (success) {
        hideReason.value = ''
        emit('close')
    }
}
</script>

<template>
    <UModal :title="$t('admin.modal.hideSetup.title')">
        <template #body>
            <div class="flex flex-col gap-2">
                <UAlert
                    icon="mingcute:eye-close-fill"
                    :title="$t('admin.modal.hideSetup.adminNote')"
                    :description="$t('admin.modal.hideSetup.description')"
                    color="warning"
                    variant="subtle"
                />
                <UFormField :label="$t('admin.modal.hideSetup.reason')" required>
                    <UTextarea v-model="hideReason" autoresize class="w-full" />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <UButton
                :disabled="!hideReason.length"
                :label="$t('admin.modal.hideSetup.button')"
                color="neutral"
                size="lg"
                block
                @click="hideSetup"
            />
        </template>
    </UModal>
</template>
