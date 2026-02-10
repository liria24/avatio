<script lang="ts" setup>
const { toggleMaintenanceMode, toggleForceUpdateItem } = useAdminActions()

const { data, status, refresh } = useFetch<EdgeConfig>('/api/edge-config', {
    dedupe: 'defer',
})

const maintenanceMode = ref(data.value?.isMaintenance || false)
const forceUpdateItem = ref(data.value?.forceUpdateItem || false)

const loading = reactive({
    maintenance: false,
    forceUpdate: false,
})

const toggleMaintenanceModeAction = async () => {
    loading.maintenance = true
    const success = await toggleMaintenanceMode(maintenanceMode.value)
    if (success) refresh()
    loading.maintenance = false
}

const toggleForceUpdateItemAction = async () => {
    loading.forceUpdate = true
    await toggleForceUpdateItem(forceUpdateItem.value)
    loading.forceUpdate = false
}
</script>

<template>
    <UModal :title="$t('admin.modal.flags.title')">
        <template #body>
            <div class="flex flex-col gap-4">
                <USwitch
                    v-model="maintenanceMode"
                    :loading="loading.maintenance || status === 'pending'"
                    :label="$t('admin.modal.flags.maintenanceMode')"
                    color="neutral"
                    @change="toggleMaintenanceModeAction()"
                />

                <USwitch
                    v-model="forceUpdateItem"
                    :loading="loading.forceUpdate || status === 'pending'"
                    :label="$t('admin.modal.flags.forceUpdateItem')"
                    color="neutral"
                    @change="toggleForceUpdateItemAction()"
                />
            </div>
        </template>
    </UModal>
</template>
