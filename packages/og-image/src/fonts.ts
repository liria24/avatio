import { googleFont, type GoogleFontOptions } from '@takumi-rs/helpers'
import type { FontLoader, Renderer } from '@takumi-rs/wasm'

export interface GoogleFontConfig {
    family: string
    options?: Omit<GoogleFontOptions, 'text'>
}

export const loadPresetFonts = async (
    renderer: Renderer,
    preset: { fonts: readonly GoogleFontConfig[] },
    text: string,
    signal?: AbortSignal,
) => {
    const descriptors = (
        await Promise.all(
            preset.fonts.map((config) => googleFont(config.family, { ...config.options, text })),
        )
    ).flat()

    await renderer.loadFonts(descriptors as FontLoader[], signal)
}
