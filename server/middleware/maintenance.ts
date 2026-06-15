const maintenanceLog = logger('maintenance')

const ignoredMaintenancePaths = [
    '/api',
    '/_nuxt',
    '/__nuxt',
    '/favicon.ico',
    '/favicon.svg',
    '/ogp.png',
    '/ogp_2.png',
    '/sw.js',
    '/manifest.webmanifest',
    '/workbox-',
]

export default defineEventHandler(async (event) => {
    const path = normalizeMaintenancePath(event.path)
    if (ignoredMaintenancePaths.some((prefix) => path.startsWith(prefix))) return

    try {
        const isMaintenance = await getMaintenanceFlag()

        if (isMaintenance && !isMaintenancePagePath(path))
            return sendRedirect(event, getMaintenancePagePath(path), 307)

        if (!isMaintenance && isMaintenancePagePath(path))
            return sendRedirect(event, getMaintenanceExitPath(path), 307)
    } catch (error) {
        maintenanceLog.error('Failed to resolve maintenance flag:', error)
    }
})
