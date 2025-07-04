export default defineNuxtRouteMiddleware(async (_to, _from) => {
    if (import.meta.server) return

    const isMaintenance = await $fetch(
        `/api/edge-config/${import.meta.dev ? 'isMaintenanceDev' : 'isMaintenance'}`
    )

    if (isMaintenance)
        showError({
            statusCode: 503,
            message: 'メンテナンス中',
        })
})
//
