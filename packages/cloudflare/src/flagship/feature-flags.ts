import type { FeatureFlags } from '@avatio/core'

type FeatureFlag = Parameters<FeatureFlags['isEnabled']>[0]

export interface FlagshipBinding {
    getBooleanValue(key: string, defaultValue: boolean): Promise<boolean>
}

const defaultFlagKeys = {
    maintenance: 'is-maintenance',
    catalogV2Reads: 'catalog-v2-reads',
    catalogV2Writes: 'catalog-v2-writes',
} satisfies Record<FeatureFlag, string>

export class CloudflareFeatureFlags implements FeatureFlags {
    constructor(
        private readonly binding?: FlagshipBinding,
        private readonly flagKeys: Readonly<Record<FeatureFlag, string>> = defaultFlagKeys,
    ) {}

    async isEnabled(flag: FeatureFlag): Promise<boolean> {
        if (!this.binding) return false

        try {
            return await this.binding.getBooleanValue(this.flagKeys[flag], false)
        } catch {
            // Operational flags fail closed. Flagship availability must not turn
            // on maintenance mode or a catalog rollout by accident.
            return false
        }
    }
}
