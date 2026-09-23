const CLOUDFLARE_WORKERS_SUFFIX = '.workers.dev'

const parseOrigin = (value: string) => {
    try {
        return new URL(value).origin
    } catch {
        return null
    }
}

export const parseConfiguredAuthOrigins = (value?: string) => {
    if (!value) return []

    try {
        const origins = JSON.parse(value)
        if (!Array.isArray(origins)) return []
        return origins.flatMap((origin) => {
            if (typeof origin !== 'string') return []
            const parsed = parseOrigin(origin)
            return parsed ? [parsed] : []
        })
    } catch {
        return []
    }
}

export const isAvatioWorkerOrigin = (origin: string) => {
    try {
        const url = new URL(origin)
        if (url.protocol !== 'https:' || !url.hostname.endsWith(CLOUDFLARE_WORKERS_SUFFIX))
            return false

        const labels = url.hostname.split('.')
        if (labels.length !== 4 || labels[2] !== 'workers' || labels[3] !== 'dev') return false

        const workerLabel = labels[0]
        if (!workerLabel) return false
        return (
            workerLabel === 'avatio' ||
            workerLabel === 'avatio-development' ||
            workerLabel.endsWith('-avatio') ||
            workerLabel.endsWith('-avatio-development')
        )
    } catch {
        return false
    }
}

export const resolveAuthTrustedOrigins = (input: {
    configuredOrigins: readonly string[]
    request?: Request
}) => {
    const origins = new Set(input.configuredOrigins.flatMap((origin) => parseOrigin(origin) ?? []))
    const requestOrigin = input.request ? parseOrigin(input.request.url) : null

    // Preview URLs have an unpredictable version/branch prefix. Trust only the exact
    // origin serving this request, and only when its worker label belongs to Avatio.
    if (requestOrigin && isAvatioWorkerOrigin(requestOrigin)) origins.add(requestOrigin)

    return [...origins]
}
