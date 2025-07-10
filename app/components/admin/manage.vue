<script lang="ts" setup>
const toast = useToast()

const { data } = await useFetch<EdgeConfig>('/api/edge-config', {
    dedupe: 'defer',
})

const maintenanceMode = ref(data.value?.isMaintenance || false)
const forceUpdateItem = ref(data.value?.forceUpdateItem || false)

const applyingMaintenance = ref(false)
const applyingForceUpdate = ref(false)

const modalMaintenance = ref(false)

const changeMaintenanceSwitch = async () => {
    if (maintenanceMode.value) modalMaintenance.value = true
    else {
        applyingMaintenance.value = true

        try {
            await $fetch('/api/edge-config', {
                method: 'PUT',
                body: { isMaintenanceDev: false },
            })
            maintenanceMode.value = false
        } catch (error) {
            console.error('Failed to disable maintenance mode:', error)
        } finally {
            applyingMaintenance.value = false
        }
    }
}

const enableMaintenanceMode = async () => {
    applyingMaintenance.value = true

    try {
        await $fetch('/api/edge-config', {
            method: 'PUT',
            body: { isMaintenanceDev: true },
        })
        maintenanceMode.value = true
    } catch (error) {
        console.error('Failed to enable maintenance mode:', error)
        toast.add({
            title: 'メンテナンスモードの有効化に失敗しました',
            color: 'error',
        })
        maintenanceMode.value = false
    } finally {
        applyingMaintenance.value = false
        modalMaintenance.value = false
    }
}

const changeForceUpdateSwitch = async () => {
    applyingForceUpdate.value = true

    try {
        await $fetch('/api/edge-config', {
            method: 'PUT',
            body: { forceUpdateItem: forceUpdateItem.value },
        })
        toast.add({
            title: 'アイテム情報の強制更新を切り替えました',
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to change "forceUpdateItem":', error)
        toast.add({
            title: '切換えに失敗しました',
            color: 'error',
        })
    } finally {
        applyingForceUpdate.value = false
    }
}
</script>

<template>
    <UModal
        v-model:open="modalMaintenance"
        :dismissible="false"
        title="メンテナンスモード"
    >
        <template #body>
            <UAlert
                title="メンテナンスモードを有効にしますか？"
                color="neutral"
                variant="subtle"
            />
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-1.5">
                <UButton
                    :disabled="applyingMaintenance"
                    label="キャンセル"
                    variant="ghost"
                    @click="
                        () => {
                            modalMaintenance = false
                            maintenanceMode = false
                        }
                    "
                />
                <UButton
                    :loading="applyingMaintenance"
                    label="有効化"
                    color="neutral"
                    @click="enableMaintenanceMode"
                />
            </div>
        </template>
    </UModal>

    <UCard>
        <template #header>
            <h2 class="text-xl font-semibold text-nowrap">管理</h2>
        </template>

        <div class="flex flex-col gap-4">
            <USwitch
                v-model="maintenanceMode"
                :loading="applyingMaintenance"
                label="メンテナンスモード"
                color="neutral"
                @change="changeMaintenanceSwitch"
            />

            <USwitch
                v-model="forceUpdateItem"
                :loading="applyingForceUpdate"
                label="アイテム情報の強制更新"
                color="neutral"
                @change="changeForceUpdateSwitch"
            />
        </div>
    </UCard>
</template>
