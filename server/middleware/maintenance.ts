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
    const path = event.path.split('?')[0] || '/'
    if (ignoredMaintenancePaths.some((prefix) => path.startsWith(prefix))) return

    try {
        const { isMaintenance } = await getAppFlags()

        if (isMaintenance && path !== '/on-maintenance')
            return sendRedirect(event, '/on-maintenance', 307)

        if (!isMaintenance && path === '/on-maintenance') return sendRedirect(event, '/', 307)
    } catch (error) {
        maintenanceLog.error('Failed to resolve maintenance flag:', error)
    }
})
