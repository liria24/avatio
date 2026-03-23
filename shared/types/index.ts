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

export type DeepWritable<T> = {
    [P in keyof T]?: T[P] extends readonly (infer U)[]
        ? U[]
        : T[P] extends object
          ? DeepWritable<T[P]>
          : T[P]
}

export type DeepNonNullable<T> = T extends null | undefined
    ? never
    : T extends Array<infer U>
      ? Array<DeepNonNullable<U>>
      : T extends object
        ? { [K in keyof T]: DeepNonNullable<T[K]> }
        : T
