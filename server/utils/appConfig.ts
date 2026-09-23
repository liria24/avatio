import type { AppConfig } from '@avatio/core/contracts'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { asc } from 'drizzle-orm'
import { providerAdmissionOptions, providerAdmissionRules } from '~~/database/schema'

export const getMaintenanceFlag = (event?: H3Event) =>
    getFeatureFlags(event).isEnabled('maintenance')

const admissionKey = (providerKey: string, facetKey: string, valueKey: string) =>
    JSON.stringify([providerKey, facetKey, valueKey])

export const readAppConfig = async (db: AppDatabase, event: H3Event): Promise<AppConfig> => {
    const [options, rules, registry, isMaintenance] = await Promise.all([
        db
            .select()
            .from(providerAdmissionOptions)
            .orderBy(
                asc(providerAdmissionOptions.providerKey),
                asc(providerAdmissionOptions.facetKey),
                asc(providerAdmissionOptions.label),
            ),
        db.select().from(providerAdmissionRules),
        getCatalogProviderRegistry(),
        getMaintenanceFlag(event),
    ])
    const decisions = new Map(
        rules.map((rule) => [
            admissionKey(rule.providerKey, rule.facetKey, rule.valueKey),
            rule.decision,
        ]),
    )
    return {
        providerAdmissions: registry.values().flatMap((provider) => {
            const admission = provider.admission
            if (!admission) return []
            return [
                {
                    providerKey: provider.key,
                    match: admission.match,
                    facets: admission.facets.map((facet) => ({
                        ...facet,
                        options: options
                            .filter(
                                (option) =>
                                    option.providerKey === provider.key &&
                                    option.facetKey === facet.key,
                            )
                            .map((option) => ({
                                valueKey: option.valueKey,
                                label: option.label,
                                decision:
                                    decisions.get(
                                        admissionKey(
                                            option.providerKey,
                                            option.facetKey,
                                            option.valueKey,
                                        ),
                                    ) ?? null,
                                firstSeenAt: option.firstSeenAt.toISOString(),
                                lastSeenAt: option.lastSeenAt.toISOString(),
                            })),
                    })),
                },
            ]
        }),
        isMaintenance,
    }
}
