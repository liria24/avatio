import type { FeatureFlags } from '../../ports'
import type { ViewerIdentity } from '../../users'

export const canViewerUseSetupItemPoints = async (
    viewer: ViewerIdentity | null,
    featureFlags: FeatureFlags,
): Promise<boolean> =>
    viewer?.role === 'admin' && !viewer.banned && (await featureFlags.isEnabled('itemPoints'))
