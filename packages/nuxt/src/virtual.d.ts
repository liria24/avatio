declare module '#avatio/content-config' {
    export const contentConfig: {
        contentDirectory: string
        locales: string[]
        fallbackLocale: string
    }
}

declare module '#avatio/routes' {
    export const reservedRootPaths: Set<string>
    export const staticPagePaths: Set<string>
    export const routeLocales: string[]
}
