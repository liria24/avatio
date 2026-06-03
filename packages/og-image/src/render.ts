import { loadPresetFonts } from './fonts'
import { getPreset } from './presets'
import type { OgImageDescriptor } from './schema'

type TakumiModule = typeof import('@takumi-rs/wasm')

let takumiPromise: Promise<TakumiModule> | undefined

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
    signal?: AbortSignal,
): Promise<Uint8Array> => {
    const { Renderer } = await ensureTakumi()
    if (signal?.aborted) throw new Error('Render aborted')

    const preset = getPreset(descriptor)
    if (!preset) throw new Error('Unknown renderer')

    const renderer = new Renderer({ loadDefaultFonts: false })

    try {
        await loadPresetFonts(renderer, preset, signal)
        return renderer.render(preset.render(descriptor.props), preset.renderOptions)
    } finally {
        renderer.free()
    }
}
