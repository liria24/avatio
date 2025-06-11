export interface Badge {
    name:
        | 'developer'
        | 'contributor'
        | 'translator'
        | 'alpha_tester'
        | 'shop_owner'
        | 'patrol'
        | 'idea_man'
    created_at: string
}

export interface Author {
    id: string
    name: string
    avatar?: string | null
    badges: Badge[]
}

export interface User extends Author {
    created_at: string
    bio: string
    links: string[]
    setups: SetupClient[]
    shops: { shop: Shop }[]
}

export interface CoAuthor extends Author {
    note: string
}

export interface Shop {
    id: string
    name: string
    thumbnail: string | null
    verified: boolean
}

export type ItemCategory =
    | 'avatar'
    | 'cloth'
    | 'accessory'
    | 'other'
    | 'hair'
    | 'shader'
    | 'texture'
    | 'tool'

export interface Shapekey {
    name: string
    value: number
}

export interface Item {
    id: number
    updated_at: string
    category: ItemCategory
    name: string
    thumbnail: string
    price: string | null
    likes: number | null
    shop: Shop
    nsfw: boolean
    outdated: boolean
    source: string | null
}

export interface SetupItem extends Item {
    note: string
    unsupported: boolean
    shapekeys: Shapekey[]
}

export interface SetupImage {
    name: string
    width?: number | null
    height?: number | null
}

export interface SetupBase {
    id: number
    created_at: string
    name: string
    description: string | null
    author: Author
    images: SetupImage[]
    unity: string | null
}

export interface SetupDB extends SetupBase {
    tags: { tag: string }[]
    co_authors: {
        user: Author
        note: string
    }[]
    items: {
        data: Item | null
        note: string
        unsupported: boolean
        category: ItemCategory | null
        shapekeys: Shapekey[]
    }[]
}

export interface SetupClient extends SetupBase {
    tags: string[]
    co_authors: CoAuthor[]
    items: Record<string, SetupItem[]>
}

export interface CategoryAttr {
    label: string
    icon: string
    items: SetupItem[]
}

export interface CategorizedSetupItems {
    avatar: CategoryAttr
    cloth: CategoryAttr
    accessory: CategoryAttr
    other: CategoryAttr
}

export interface DocumentData {
    slug: string
    created_at: string
    updated_at: string
    short_title?: string
    title: string
    description?: string
    thumbnail?: string | null
    category?: 'news' | 'update' | 'event' | 'blog'
    content: string
    published: boolean
}

export interface HeaderBadge {
    label: string
    link: string
}

export interface ErrorType {
    status: number
    message: string
}
