import type { ConstructRendererOptions, Node, RenderOptions } from '@takumi-rs/wasm'
import type { GenericSchema, InferOutput } from 'valibot'

import type { GoogleFontConfig } from './fonts'

type PresetRenderOptions = Omit<RenderOptions, 'width' | 'height' | 'format' | 'devicePixelRatio'>
type PresetPropsSchema = GenericSchema
type FontTextValue = string | null | undefined | false
type FontText = string | readonly FontTextValue[]

export interface DefinePresetOptions<TPropsSchema extends PresetPropsSchema> {
    version: string
    props: TPropsSchema
    fonts: readonly GoogleFontConfig[]
    fontText: (props: InferOutput<TPropsSchema>) => FontText
    render: (props: InferOutput<TPropsSchema>) => Node
    width?: number
    height?: number
    format?: RenderOptions['format']
    devicePixelRatio?: number
    persistentImages?: ConstructRendererOptions['persistentImages']
    renderOptions?: PresetRenderOptions
}

interface PresetRenderConfig {
    width: number
    height: number
    format: RenderOptions['format']
    devicePixelRatio: number
}

export interface OgImagePreset {
    id: string
    version: string
    props: PresetPropsSchema
    fonts: readonly GoogleFontConfig[]
    fontText: (props: unknown) => string
    render: (props: unknown) => Node
    renderOptions: PresetRenderConfig
    persistentImages?: ConstructRendererOptions['persistentImages']
}

export type DefinedOgImagePreset<TPropsSchema extends PresetPropsSchema> = Omit<
    OgImagePreset,
    'id' | 'props' | 'fontText' | 'render'
> & {
    props: TPropsSchema
    fontText: (props: InferOutput<TPropsSchema>) => string
    render: (props: InferOutput<TPropsSchema>) => Node
}

export const definePreset = <const TPropsSchema extends PresetPropsSchema>(
    options: DefinePresetOptions<TPropsSchema>,
): DefinedOgImagePreset<TPropsSchema> => {
    const {
        fontText,
        width = 1200,
        height = 630,
        format = 'png',
        devicePixelRatio = 1,
        renderOptions,
        ...preset
    } = options

    return {
        ...preset,
        fontText: (props) => normalizeFontText(fontText(props)),
        renderOptions: {
            width,
            height,
            format,
            devicePixelRatio,
            ...renderOptions,
        },
    }
}

const normalizeFontText = (value: FontText) =>
    typeof value === 'string'
        ? value
        : value.filter((text): text is string => Boolean(text)).join('\n')

export const withPresetId = <const TPropsSchema extends PresetPropsSchema>(
    preset: DefinedOgImagePreset<TPropsSchema>,
    id: string,
): OgImagePreset => ({
    ...preset,
    id,
    fontText: preset.fontText as (props: unknown) => string,
    render: preset.render as (props: unknown) => Node,
})
