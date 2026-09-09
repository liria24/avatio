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

export interface WritableAppConfig {
    allowedBoothCategoryId: number[]
    catalogCategoryOverrides: Record<string, ItemCategory>
}

export interface AppConfig extends WritableAppConfig {
    readonly isMaintenance: boolean
}

export type DeepNonNullable<T> = T extends null | undefined
    ? never
    : T extends Array<infer U>
      ? Array<DeepNonNullable<U>>
      : T extends object
        ? { [K in keyof T]: DeepNonNullable<T[K]> }
        : T
