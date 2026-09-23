import { z } from 'zod'

export const itemCategories = [
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
] as const

export const itemCategorySchema = z.enum(itemCategories)
export type ItemCategory = z.infer<typeof itemCategorySchema>

export const categoryOverrideOrigins = ['ai', 'manual', 'rule', 'legacy'] as const
export const categoryOverrideOriginSchema = z.enum(categoryOverrideOrigins)
export type CategoryOverrideOrigin = z.infer<typeof categoryOverrideOriginSchema>

export interface EffectiveCategoryInput {
    setupOverride?: ItemCategory | null
    catalogOverride?: ItemCategory | null
    primarySourceCategory?: ItemCategory | null
}

export const resolveEffectiveCategory = ({
    setupOverride,
    catalogOverride,
    primarySourceCategory,
}: EffectiveCategoryInput): ItemCategory =>
    setupOverride ?? catalogOverride ?? primarySourceCategory ?? 'other'
