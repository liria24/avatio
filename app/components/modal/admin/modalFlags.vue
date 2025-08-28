<script lang="ts" setup>
const toast = useToast()
const nuxtApp = useNuxtApp()

const { data, status, refresh } = useFetch<EdgeConfig>('/api/edge-config', {
    dedupe: 'defer',
    headers:
        import.meta.server && nuxtApp.ssrContext?.event.headers
            ? nuxtApp.ssrContext.event.headers
            : undefined,
})

const maintenanceMode = ref(data.value?.isMaintenance || false)
const forceUpdateItem = ref(data.value?.forceUpdateItem || false)

const loading = reactive({
    maintenance: false,
    forceUpdate: false,
})

const toggleMaintenanceMode = async () => {
    loading.maintenance = true

    try {
        await $fetch('/api/edge-config', {
            method: 'PUT',
            body: { isMaintenance: maintenanceMode.value },
        })
    } catch (error) {
        console.error('Failed to toggle maintenance mode:', error)
        toast.add({
            title: '切替えに失敗しました',
            color: 'error',
        })
    } finally {
        loading.maintenance = false
        refresh()
    }
}

const toggleForceUpdate = async () => {
    loading.forceUpdate = true

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
        loading.forceUpdate = false
    }
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
