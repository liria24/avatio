import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineNitroConfig } from 'nitropack/config'

import {
    createFontAssets,
    includeLatinAndNumberedSubsets,
    sortLatinAndNumberedSubsets,
} from './build/font-assets'

const fontAssets = createFontAssets(import.meta.url, [
    {
        packageName: '@fontsource-variable/noto-sans-jp',
        moduleId: '#og-image-fonts/noto-sans-jp',
        publicBaseURL: '/_og/fonts/noto-sans-jp',
        generatedDir: './.nitro/public-fonts/noto-sans-jp',
        includeSubset: includeLatinAndNumberedSubsets({ maxNumberedShard: 119 }),
        sortSubsets: sortLatinAndNumberedSubsets,
    },
])

export default defineNitroConfig({
    compatibilityDate: '2026-06-03',

    preset: 'cloudflare-module',

    cloudflare: {
        deployConfig: true,
        nodeCompat: true,
        wrangler: {
            name: 'og-image',
            observability: {
                enabled: true,
                head_sampling_rate: 1,
            },
            kv_namespaces: [
                {
                    binding: 'OG_IMAGE_CACHE',
                    id: 'e678f8e834784ea8b457786c695ded19',
                },
            ],
        },
    },

    storage: {
        'og-image': {
            driver: 'cloudflare-kv-binding',
            binding: 'OG_IMAGE_CACHE',
        },
    },

    devStorage: {
        'og-image': {
            driver: 'fs',
            base: './.data/og-image',
        },
    },

    alias: {
        '@src': fileURLToPath(new URL('./src', import.meta.url)),
    },

    publicAssets: fontAssets.publicAssets,

    virtual: {
        '#og-image-presets': () => {
            const presetsDir = fileURLToPath(new URL('./src/presets', import.meta.url))
            const names = readdirSync(presetsDir)
                .filter((f) => f.endsWith('.ts'))
                .map((f) => f.replace(/\.ts$/, ''))
            const imports = names
                .map(
                    (name, i) =>
                        `import _preset${i} from '${fileURLToPath(new URL(`./src/presets/${name}.ts`, import.meta.url)).replace(/\\/g, '/')}'`,
                )
                .join('\n')
            const exports = `export const allPresets = [${names.map((_, i) => `_preset${i}`).join(', ')}]`
            return [imports, exports].join('\n')
        },
    },

    rollupConfig: {
        plugins: fontAssets.plugins,
    },

    experimental: {
        wasm: true,
    },
})
