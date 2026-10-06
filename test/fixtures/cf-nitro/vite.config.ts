import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
// This isolated fixture tests the official Vite delegate, outside the application's Vite+ build.
// eslint-disable-next-line vite-plus/prefer-vite-plus-imports
import { defineConfig } from 'vite'

// Package real Nitro output using the official plugin, without replacing Nuxt's server.
export default defineConfig({
    publicDir: fileURLToPath(new URL('../../../.output/public', import.meta.url)),
    plugins: [cloudflare({ remoteBindings: false, types: { generate: false } })],
})
