import { z } from 'zod'

import {
    providerAdmissionDecisions,
    type ProviderAdmissionDecision,
    type ProviderAdmissionDiscovery,
    type ProviderAdmissionMatch,
} from '../catalog/ports'

export const catalogSyncMessageSchema = z.object({
    version: z.literal(2),
    type: z.literal('catalog.sync-source'),
    sourceId: z.string().min(1),
    leaseToken: z.string().min(1),
})

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
