export default defineNuxtRouteMiddleware(async (_to, _from) => {
    if (import.meta.server) return

    const isMaintenance = await $fetch(
        `/api/edge-config/${import.meta.dev ? 'isMaintenanceDev' : 'isMaintenance'}`
    )

    if (isMaintenance)
        if (_to.path !== '/on-maintenance') return navigateTo('/on-maintenance')
        else if (_to.path === '/on-maintenance') return navigateTo('/')
})
