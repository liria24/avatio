import { getMaintenanceFlag } from '../utils/appConfig'

const maintenanceLog = logger('maintenance')

const ignoredMaintenancePaths = [
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
    if (path === '/api/admin/config') return
    if (ignoredMaintenancePaths.some((prefix) => path.startsWith(prefix))) return

    let isMaintenance: boolean
    try {
        isMaintenance = await getMaintenanceFlag(event)
    } catch (error) {
        maintenanceLog.error('Failed to resolve maintenance flag:', error)
        return
    }

    if (isMaintenance && path.startsWith('/api')) {
        setResponseHeader(event, 'Retry-After', 60)
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'The service is temporarily unavailable during maintenance.',
        })
    }

    if (isMaintenance && !isMaintenancePagePath(path))
        return sendRedirect(event, getMaintenancePagePath(path), 307)

    if (!isMaintenance && isMaintenancePagePath(path))
        return sendRedirect(event, getMaintenanceExitPath(path), 307)
})
