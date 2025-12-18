import type { Serialize, Simplify } from 'nitropack'

export type Serialized<T> = Simplify<Serialize<T>>

export interface PaginationResponse<T> {
    data: T
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export interface EdgeConfig {
    allowedBoothCategoryId: number[]
    forceUpdateItem: boolean
    isMaintenance: boolean
    specificItemCategories: Record<Platform, Record<string, ItemCategory>>
}
