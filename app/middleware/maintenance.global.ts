export default defineNuxtRouteMiddleware(async (to, _from) => {
    if (import.meta.server) return

    const { $session } = useNuxtApp()

    const [session, isMaintenance] = await Promise.all([
        $session(),
        $fetch(
            `/api/edge-config/${import.meta.dev ? 'isMaintenanceDev' : 'isMaintenance'}`
        ),
    ])

    if (isMaintenance && session.value?.user.role !== 'admin') {
        if (to.path !== '/on-maintenance') return navigateTo('/on-maintenance')
    } else {
        if (to.path === '/on-maintenance') return navigateTo('/')
    }
})
