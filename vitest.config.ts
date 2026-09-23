import { defineVitestProject } from '@nuxt/test-utils/config'
import { loadEnv } from 'vite-plus'
import { defineConfig } from 'vitest/config'

const env = loadEnv('test', process.cwd(), '')

const selectedProjectIndex = process.argv.findIndex((arg) => arg === '--project')
const selectedProject =
    selectedProjectIndex >= 0 ? process.argv[selectedProjectIndex + 1] : undefined
const needsNuxt = selectedProject !== 'unit' && selectedProject !== 'e2e'

export default defineConfig({
    test: {
        projects: [
            {
                resolve: {
                    alias: {
                        '@@': process.cwd(),
                        '~~': process.cwd(),
                    },
                },
                test: {
                    name: 'unit',
                    include: ['test/unit/**/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test/setup.ts'],
                    env,
                },
            },
            {
                test: {
                    name: 'e2e',
                    sequence: { groupOrder: 1 },
                    include: ['test/e2e/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    env,
                },
            },
            ...(needsNuxt
                ? [
                      await defineVitestProject({
                          test: {
                              name: 'nuxt',
                              include: ['test/nuxt/*.{test,spec}.ts'],
                              environment: 'nuxt',
                              globals: true,
                              env,
                          },
                      }),
                  ]
                : []),
        ],
    },
})
