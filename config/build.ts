import { getStageConfig } from './environment.ts'

/** Build-time public settings, independent of either deployment CLI and of signing secrets. */
export const getBuildEnvironment = (env: Record<string, string | undefined>, dev: boolean) => {
    const stage = !dev && env.STAGE ? getStageConfig(env.STAGE) : undefined
    if (env.PREVIEW_NAME)
        throw new Error('Native Preview builds are retired; select a stage Worker.')
    if (
        stage &&
        ((env.PUBLIC_SITE_URL && env.PUBLIC_SITE_URL !== stage.siteUrl) ||
            (env.R2_PUBLIC_BASE_URL && env.R2_PUBLIC_BASE_URL !== stage.imageBaseUrl))
    )
        throw new Error('Build URLs must match the selected stage.')
    const siteUrl = stage?.siteUrl ?? env.PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const imageBaseUrl = stage?.imageBaseUrl ?? env.R2_PUBLIC_BASE_URL
    const publicUrl = ['localhost', '127.0.0.1'].includes(new URL(siteUrl).hostname)
        ? 'https://avatio.me'
        : siteUrl

    return {
        siteUrl,
        publicUrl,
        imageBaseUrl,
        twitterAuthEnabled: Boolean(stage || (env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET)),
        emailPasswordAuthEnabled: dev,
    }
}
