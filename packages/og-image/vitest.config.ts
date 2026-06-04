import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [
        {
            name: 'mock-og-image-assets',
            resolveId(id) {
                if (id === '#og-image-images') return '\0#og-image-images'
            },
            load(id) {
                if (id === '\0#og-image-images')
                    return [
                        'export const images = {',
                        '  avatio: {',
                        "    src: 'avatio',",
                        '    svg: \'<svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" stroke="currentColor"><path d="M0 0" /></svg>\',',
                        '  },',
                        '}',
                    ].join('\n')
            },
        },
    ],
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
