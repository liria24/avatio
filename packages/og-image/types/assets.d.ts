declare module '*.woff2' {
    const value: ArrayBuffer
    export default value
}

declare module '#og-image-fonts/*' {
    interface FontAssetDefinition {
        key: string
        name: string
        path: string
        ranges: readonly (readonly [number, number])[]
    }

    export const fontFamily: string
    export const fonts: readonly FontAssetDefinition[]
}
