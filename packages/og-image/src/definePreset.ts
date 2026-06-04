import type { Node, RenderOptions } from '@takumi-rs/wasm'

import type { GoogleFontConfig } from './fonts'

type PresetRenderOptions = Omit<RenderOptions, 'width' | 'height' | 'format' | 'devicePixelRatio'>

export interface DefinePresetOptions<TProps> {
    id: string
    version: string
    cacheKey: string
    schema: unknown
    fonts: readonly GoogleFontConfig[]
    fontText: (props: TProps) => string
    render: (props: TProps) => Node
    width: number
    height: number
    format?: RenderOptions['format']
    devicePixelRatio?: number
    renderOptions?: PresetRenderOptions
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OgImagePreset {
    id: string
    version: string
    cacheKey: string
    schema: unknown
    fonts: readonly GoogleFontConfig[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fontText: (props: any) => string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (props: any) => Node
    renderOptions: {
        width: number
        height: number
        format: RenderOptions['format']
        devicePixelRatio: number
    }
}

export const definePreset = <
    TProps,
    const TOptions extends DefinePresetOptions<TProps> = DefinePresetOptions<TProps>,
>(
    options: TOptions,
) => {
    const {
        width,
        height,
        format = 'png',
        devicePixelRatio = 1,
        renderOptions,
        ...preset
    } = options

    return {
        ...preset,
        renderOptions: {
            width,
            height,
            format,
            devicePixelRatio,
            ...renderOptions,
        },
    } as const
}
