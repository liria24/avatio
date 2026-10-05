import { getStageConfig } from './environment.ts'
import { getPreviewKind } from './preview.ts'

export const requireHttpsOrigin = (value: string | undefined, name: string) => {
    if (!value) throw new Error(`${name} is required.`)
    const url = new URL(value)
    if (url.protocol !== 'https:' || value !== url.origin)
        throw new Error(`${name} must be an HTTPS origin without a path or credentials.`)
    return url.origin
}

/** Build-time public settings, independent of either deployment CLI and of signing secrets. */
export const getBuildEnvironment = (env: Record<string, string | undefined>, dev: boolean) => {
    const stage = !dev && env.STAGE ? getStageConfig(env.STAGE) : undefined
    const previewKind = dev ? undefined : getPreviewKind(env.STAGE, env.PREVIEW_NAME)
    const siteUrl = previewKind
        ? requireHttpsOrigin(env.PUBLIC_SITE_URL, 'PUBLIC_SITE_URL')
        : (stage?.siteUrl ?? env.PUBLIC_SITE_URL ?? 'http://localhost:3000')
    const imageBaseUrl = previewKind
        ? requireHttpsOrigin(env.R2_PUBLIC_BASE_URL, 'R2_PUBLIC_BASE_URL')
        : (stage?.imageBaseUrl ?? env.R2_PUBLIC_BASE_URL)
    const ogImageEndpoint = previewKind
        ? requireHttpsOrigin(env.OG_IMAGE_ENDPOINT, 'OG_IMAGE_ENDPOINT')
        : undefined
    if (previewKind) {
        const production = getStageConfig('production')
        if (
            siteUrl === production.siteUrl ||
            imageBaseUrl === production.imageBaseUrl ||
            ogImageEndpoint === 'https://og.liria.me'
        )
            throw new Error('Preview build URLs must not target production services.')
    }
    const publicUrl = ['localhost', '127.0.0.1'].includes(new URL(siteUrl).hostname)
        ? 'https://avatio.me'
        : siteUrl

    return {
        siteUrl,
        publicUrl,
        imageBaseUrl,
        ogImageEndpoint,
        previewKind,
        twitterAuthEnabled:
            previewKind === 'pr'
                ? false
                : Boolean(stage || (env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET)),
        emailPasswordAuthEnabled: dev || previewKind === 'pr',
    }
}
