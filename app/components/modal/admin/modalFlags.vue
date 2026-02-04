<script lang="ts" setup>
const {
    toggleMaintenanceMode: toggleMaintenanceModeAction,
    toggleForceUpdateItem: toggleForceUpdateItemAction,
} = useAdminActions()

const { data, status, refresh } = useFetch<EdgeConfig>('/api/edge-config', {
    dedupe: 'defer',
})

const maintenanceMode = ref(data.value?.isMaintenance || false)
const forceUpdateItem = ref(data.value?.forceUpdateItem || false)

const loading = reactive({
    maintenance: false,
    forceUpdate: false,
})

const toggleMaintenanceMode = async () => {
    loading.maintenance = true
    const success = await toggleMaintenanceModeAction(maintenanceMode.value)
    if (success) refresh()
    loading.maintenance = false
}

const toggleForceUpdate = async () => {
    loading.forceUpdate = true
    await toggleForceUpdateItemAction(forceUpdateItem.value)
    loading.forceUpdate = false
}
</script>

<template>
    <UModal title="Flags">
        <template #body>
            <div class="flex flex-col gap-4">
                <USwitch
                    v-model="maintenanceMode"
                    :loading="loading.maintenance || status === 'pending'"
                    label="メンテナンスモード"
                    color="neutral"
                    @change="toggleMaintenanceMode()"
                />

                <USwitch
                    v-model="forceUpdateItem"
                    :loading="loading.forceUpdate || status === 'pending'"
                    label="アイテム情報の強制更新"
                    color="neutral"
                    @change="toggleForceUpdate()"
                />
            </div>
        </template>
    </UModal>
</template>
