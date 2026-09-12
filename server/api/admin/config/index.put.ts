import { providerAdmissionOptions, providerAdmissionRules } from '@@/database/schema'
import { writableAppConfigSchema } from '@avatio/core/contracts'
import { and, eq, or, sql } from 'drizzle-orm'

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const config = await validateBody(writableAppConfigSchema, { sanitize: true })
    const [registry, existingOptions] = await Promise.all([
        getCatalogProviderRegistry(),
        db.select().from(providerAdmissionOptions),
    ])
    const optionKey = (providerKey: string, facetKey: string, valueKey: string) =>
        JSON.stringify([providerKey, facetKey, valueKey])
    const optionByKey = new Map(
        existingOptions.map((option) => [
            optionKey(option.providerKey, option.facetKey, option.valueKey),
            option,
        ]),
    )
    const configuredFacets = registry
        .values()
        .flatMap((provider) =>
            (provider.admission?.facets ?? [])
                .filter(({ discovery }) => discovery === 'configured-only')
                .map(({ key }) => ({ providerKey: provider.key, facetKey: key })),
        )
    const configuredOptions: (typeof providerAdmissionOptions.$inferInsert)[] = []
    const rules: (typeof providerAdmissionRules.$inferInsert)[] = []
    const seen = new Set<string>()

    for (const input of config.providerAdmissionRules) {
        const provider = registry.get(input.providerKey)
        const facet = provider?.admission?.facets.find(({ key }) => key === input.facetKey)
        if (!provider || !facet)
            throw serverError.badRequest({ responseMessage: 'Unknown provider admission facet.' })

        const option =
            facet.discovery === 'observed'
                ? optionByKey.get(optionKey(provider.key, facet.key, input.valueKey))
                : provider.normalizeAdmissionValue?.(facet.key, input.label)
        if (!option)
            throw serverError.badRequest({ responseMessage: 'Unknown provider admission value.' })
        const key = optionKey(provider.key, facet.key, option.valueKey)
        if (seen.has(key))
            throw serverError.badRequest({ responseMessage: 'Duplicate provider admission rule.' })
        seen.add(key)
        if (facet.discovery === 'configured-only')
            configuredOptions.push({
                providerKey: provider.key,
                facetKey: facet.key,
                valueKey: option.valueKey,
                label: option.label,
            })
        rules.push({
            providerKey: provider.key,
            facetKey: facet.key,
            valueKey: option.valueKey,
            decision: input.decision,
        })
    }

    const queries: Parameters<typeof executeAppBatch>[1] = [db.delete(providerAdmissionRules)]
    if (configuredFacets.length)
        queries.push(
            db
                .delete(providerAdmissionOptions)
                .where(
                    or(
                        ...configuredFacets.map(({ providerKey, facetKey }) =>
                            and(
                                eq(providerAdmissionOptions.providerKey, providerKey),
                                eq(providerAdmissionOptions.facetKey, facetKey),
                            ),
                        ),
                    ),
                ),
        )
    if (configuredOptions.length)
        queries.push(
            db
                .insert(providerAdmissionOptions)
                .values(configuredOptions)
                .onConflictDoUpdate({
                    target: [
                        providerAdmissionOptions.providerKey,
                        providerAdmissionOptions.facetKey,
                        providerAdmissionOptions.valueKey,
                    ],
                    set: { label: sql`excluded.label`, lastSeenAt: new Date() },
                }),
        )
    if (rules.length) queries.push(db.insert(providerAdmissionRules).values(rules))
    await executeAppBatch(db, queries)
    return readAppConfig(db, event)
})
