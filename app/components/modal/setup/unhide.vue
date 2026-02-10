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
const { unhideSetup: unhideSetupAction } = useAdminActions()

const unhideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: t('errors.unauthorized'),
            description: t('errors.adminRequired'),
            color: 'error',
        })
        return
    }

    const success = await unhideSetupAction(props.setupId)
    if (success) emit('close')
}
</script>

<template>
    <UModal :title="$t('admin.modal.unhideSetup.title')">
        <template #body>
            <UAlert
                icon="mingcute:eye-2-fill"
                :title="$t('admin.modal.unhideSetup.adminNote')"
                :description="$t('admin.modal.unhideSetup.description')"
                color="info"
                variant="subtle"
            />
        </template>
        <template #footer>
            <UButton
                :label="$t('admin.modal.unhideSetup.button')"
                color="neutral"
                size="lg"
                block
                @click="unhideSetup"
            />
        </template>
    </UModal>
</template>
