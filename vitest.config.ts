import { defineVitestProject } from '@nuxt/test-utils/config'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const env = loadEnv('test', process.cwd(), '')

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['test/unit/**/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test/setup.ts'],
                    env,
                },
            },
            await defineVitestProject({
                plugins: [
                    {
                        name: 'mock-pwa-virtual',
                        resolveId(id) {
                            if (id.startsWith('virtual:pwa-register')) return `\0${id}`
                        },
                        load(id) {
                            if (id.startsWith('\0virtual:pwa-register'))
                                return 'export default () => {}; export const useRegisterSW = () => ({})'
                        },
                    },
                ],
                test: {
                    name: 'nuxt',
                    include: ['test/nuxt/*.{test,spec}.ts'],
                    environment: 'nuxt',
                    globals: true,
                    env,
                },
            }),
        ],
    },
})
