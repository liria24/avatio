declare module '#avatio/content' {
    import type { AvatioSourceContentPage } from './runtime/content'

    export const contentPages: Record<string, AvatioSourceContentPage>
    export const contentLocales: string[]
    export const fallbackLocale: string
}

declare module '#avatio/routes' {
    export const reservedRootPaths: Set<string>
}
