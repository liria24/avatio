import type { H3Event } from '@nuxt/nitro-server/h3'

export const canUseSetupItemPoints = async (
    event: H3Event,
    viewer?: { role?: string | null; banned?: boolean | null } | null,
) =>
    viewer?.role === 'admin' &&
    !viewer.banned &&
    (await getFeatureFlags(event).isEnabled('itemPoints'))
