import { z } from 'zod'

import {
    providerAdmissionDecisions,
    type ProviderAdmissionDecision,
    type ProviderAdmissionDiscovery,
    type ProviderAdmissionMatch,
} from '../catalog/ports/catalog-provider'

export const writableAppConfigSchema = z.object({
    providerAdmissionRules: z
        .object({
            providerKey: z.string().trim().min(1).max(100),
            facetKey: z.string().trim().min(1).max(100),
            valueKey: z.string().trim().min(1).max(500),
            label: z.string().trim().min(1).max(500),
            decision: z.enum(providerAdmissionDecisions),
        })
        .array(),
})
export type WritableAppConfig = z.infer<typeof writableAppConfigSchema>

export interface ProviderAdmissionOptionConfig {
    valueKey: string
    label: string
    decision: ProviderAdmissionDecision | null
    firstSeenAt: string
    lastSeenAt: string
}

export interface ProviderAdmissionFacetConfig {
    key: string
    discovery: ProviderAdmissionDiscovery
    options: ProviderAdmissionOptionConfig[]
}

export interface ProviderAdmissionConfig {
    providerKey: string
    match: ProviderAdmissionMatch
    facets: ProviderAdmissionFacetConfig[]
}

export interface AppConfig {
    providerAdmissions: ProviderAdmissionConfig[]
    readonly isMaintenance: boolean
}
