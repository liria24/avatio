export default defineNuxtRouteMiddleware(async (_to, _from) => {
    if (import.meta.server) return

    const { $session } = useNuxtApp()

    const [session, isMaintenance] = await Promise.all([
        $session(),
        $fetch(
            `/api/edge-config/${import.meta.dev ? 'isMaintenanceDev' : 'isMaintenance'}`
        ),
    ])

    if (isMaintenance && session.value?.user.role !== 'admin')
        showError({
            statusCode: 503,
            message: 'メンテナンス中',
        })
})
//
