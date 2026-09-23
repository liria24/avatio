import type { CatalogItemId } from '../../catalog'
import type { ItemCategory } from '../../catalog/domain/category'

export type SetupId = string
export type SetupEntryId = string

export interface SetupEntryShapekey {
    name: string
    value: number
}

export interface SetupEntry {
    id: SetupEntryId
    setupId: SetupId
    catalogItemId: CatalogItemId
    categoryOverride: ItemCategory | null
    unsupported: boolean
    note: string | null
    shapekeys: SetupEntryShapekey[]
}
