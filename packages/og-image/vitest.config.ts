import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@src': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        name: 'og-image',
        include: ['test/**/*.{test,spec}.ts'],
        environment: 'node',
        globals: true,
    },
})
