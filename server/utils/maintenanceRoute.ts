const maintenancePagePath = '/on-maintenance'
const localizedMaintenancePagePaths = new Set(
    prefixedI18nLocales.map((locale) => `/${locale}${maintenancePagePath}`),
)
const prefixedI18nLocaleSet = new Set<string>(prefixedI18nLocales)

export const normalizeMaintenancePath = (pathWithQuery: string) => {
    const path = pathWithQuery.split('?')[0] || '/'
    return path.length > 1 ? path.replace(/\/+$/, '') : path
}

export const isMaintenancePagePath = (path: string) => {
    const normalizedPath = normalizeMaintenancePath(path)

    return (
        normalizedPath === maintenancePagePath || localizedMaintenancePagePaths.has(normalizedPath)
    )
}

const getLocalePrefix = (path: string) => {
    const normalizedPath = normalizeMaintenancePath(path)
    const locale = normalizedPath.split('/')[1]

    return locale && prefixedI18nLocaleSet.has(locale) ? locale : undefined
}

export const getMaintenancePagePath = (path: string) => {
    const locale = getLocalePrefix(path)

    return locale ? `/${locale}${maintenancePagePath}` : maintenancePagePath
}

export const getMaintenanceExitPath = (path: string) => {
    const locale = getLocalePrefix(path)

    return locale ? `/${locale}` : '/'
}
