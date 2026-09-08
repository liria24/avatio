import { itemCategorySchema } from '@avatio/core/catalog'
import { z } from 'zod'

export const catalogSourcePublicSchema = z.object({
    id: z.string(),
    providerKey: z.string(),
    externalId: z.string(),
    canonicalUrl: z.url(),
    availability: z.enum(['available', 'withdrawn', 'policy_rejected', 'unknown']),
    syncState: z.enum(['fresh', 'stale', 'syncing', 'error']),
    price: z.string().nullable(),
    popularityCount: z.number().nullable(),
    publisher: z
        .object({
            id: z.string(),
            providerKey: z.string(),
            externalId: z.string(),
            canonicalUrl: z.url(),
            name: z.string(),
            image: z.string().nullable(),
            providerVerified: z.boolean(),
        })
        .nullable(),
    forks: z.number().optional(),
    version: z.string().optional(),
    contributors: z.object({ name: z.string(), avatarUrl: z.url().optional() }).array().optional(),
})
export type CatalogSourceView = z.infer<typeof catalogSourcePublicSchema>

export const catalogItemPublicSchema = z.object({
    id: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    name: z.string(),
    displayNameOverride: z.string().nullable(),
    category: itemCategorySchema,
    image: z.string().nullable(),
    nsfw: z.boolean(),
    primarySource: catalogSourcePublicSchema.nullable(),
})
export type CatalogItemView = z.infer<typeof catalogItemPublicSchema>

export const setupEntryPublicSchema = z.object({
    id: z.string(),
    catalogItem: catalogItemPublicSchema,
    category: itemCategorySchema,
    categoryOverride: itemCategorySchema.nullable(),
    unsupported: z.boolean(),
    note: z.string().nullable(),
    shapekeys: z.object({ name: z.string(), value: z.number() }).array(),
})
export type SetupEntryView = z.infer<typeof setupEntryPublicSchema>
