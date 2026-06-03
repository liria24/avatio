import type { Renderer } from '@takumi-rs/wasm'

export interface FontDefinition {
    key: string
    name: string
    data: ArrayBuffer
}

export const defineFont = (key: string, name: string, data: ArrayBuffer): FontDefinition => ({
    key,
    name,
    data,
})

export const loadPresetFonts = async (
    renderer: Renderer,
    preset: { fonts: readonly FontDefinition[] },
    signal?: AbortSignal,
) => {
    await renderer.loadFonts([...preset.fonts], signal)
}
