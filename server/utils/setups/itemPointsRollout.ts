import type { AvatioRequestScope } from '@avatio/core'
import { canViewerUseSetupItemPoints } from '@avatio/core/setups'

export const canUseSetupItemPoints = (
    services: Pick<AvatioRequestScope, 'viewer' | 'getFeatureFlags'>,
) => canViewerUseSetupItemPoints(services.viewer, services.getFeatureFlags())
