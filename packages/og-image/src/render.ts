import { loadPresetFonts } from './fonts'
import { getPreset } from './getPreset'
import type { OgImageDescriptor } from './schema'

type TakumiModule = typeof import('@takumi-rs/wasm')

let takumiPromise: Promise<TakumiModule> | undefined

export interface RenderContext {
    signal?: AbortSignal
}

const loadTakumiForDev = async () => {
    const [takumi, { readFileSync }, { createRequire }] = await Promise.all([
        import('@takumi-rs/wasm/no-bundler'),
        import('node:fs'),
        import('node:module'),
    ])
    const require = createRequire(import.meta.url)
    const wasmBytes = readFileSync(require.resolve('@takumi-rs/wasm/takumi_wasm_bg.wasm'))

    await takumi.default({ module_or_path: wasmBytes })
    return takumi as TakumiModule
}

const loadTakumi = async () => {
    if (import.meta.dev) return loadTakumiForDev()

    const [takumi, wasm] = await Promise.all([
        import('@takumi-rs/wasm'),
        import('@takumi-rs/wasm/next'),
    ])

    await takumi.default({ module_or_path: wasm.default })
    return takumi
}

const ensureTakumi = () => {
    takumiPromise ??= loadTakumi()
    return takumiPromise
}

export const renderDescriptor = async (
    descriptor: OgImageDescriptor,
    context: RenderContext = {},
): Promise<Uint8Array> => {
    if (context.signal?.aborted) throw new Error('Render aborted')

    const preset = getPreset(descriptor)
    if (!preset) throw new Error('Unknown renderer')

    const { Renderer } = await ensureTakumi()
    if (context.signal?.aborted) throw new Error('Render aborted')

    const renderer = new Renderer({ loadDefaultFonts: false })
    try {
        await loadPresetFonts(renderer, preset, preset.fontText(descriptor.props), context.signal)
        return renderer.render(preset.render(descriptor.props), preset.renderOptions)
    } finally {
        renderer.free()
    }
}
