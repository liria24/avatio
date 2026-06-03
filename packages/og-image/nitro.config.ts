import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineNitroConfig } from 'nitropack/config'
import type { Plugin } from 'rollup'

const withoutQuery = (id: string) => id.split('?')[0] ?? id

const inlineFontAssets = (): Plugin => ({
    name: 'inline-og-image-font-assets',
    load(id) {
        const filePath = withoutQuery(id)
        if (!filePath.endsWith('.woff2')) return null

        return [
            `const binary = atob(${JSON.stringify(readFileSync(filePath).toString('base64'))})`,
            'const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))',
            'export default bytes.buffer',
        ].join('\n')
    },
})

export default defineNitroConfig({
    compatibilityDate: '2026-06-03',

    preset: 'cloudflare-module',

    cloudflare: {
        deployConfig: true,
        nodeCompat: true,
        wrangler: {
            name: 'avatio-og-image',
            observability: {
                enabled: true,
                head_sampling_rate: 1,
            },
            kv_namespaces: [
                {
                    binding: 'OG_IMAGE_CACHE',
                    id: 'replace-with-og-image-cache-kv-namespace-id',
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

    rollupConfig: {
        plugins: [inlineFontAssets()],
    },

    experimental: {
        wasm: true,
    },
})
