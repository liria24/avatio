import { loadEnv } from 'vite-plus'
import { defineConfig } from 'vitest/config'

const env = loadEnv('test', process.cwd(), '')

const selectedProjects = process.argv.flatMap((arg, index, args) =>
    arg === '--project'
        ? [args[index + 1] ?? '']
        : arg.startsWith('--project=')
          ? [arg.slice('--project='.length)]
          : [],
)
const needsNuxt = selectedProjects.length === 0 || selectedProjects.includes('nuxt')

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
                    setupFiles: ['./test/unitSetup.ts'],
                    env,
                },
            },
            {
                resolve: { alias: { '@@': process.cwd(), '~~': process.cwd() } },
                test: {
                    name: 'integration',
                    include: ['test/integration/**/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test/setup.ts'],
                    env,
                },
            },
            {
                resolve: { alias: { '@@': process.cwd(), '~~': process.cwd() } },
                test: {
                    name: 'cloudflare',
                    include: ['test/cloudflare/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    fileParallelism: false,
                    hookTimeout: 120_000,
                    testTimeout: 30_000,
                    env,
                },
            },
            {
                test: {
                    name: 'http',
                    sequence: { groupOrder: 3 },
                    include: ['test/http/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    fileParallelism: false,
                    hookTimeout: 120_000,
                    testTimeout: 30_000,
                    env,
                },
            },
            ...(needsNuxt
                ? [
                      await (
                          await import('@nuxt/test-utils/config')
                      ).defineVitestProject({
                          test: {
                              name: 'nuxt',
                              sequence: { groupOrder: 2 },
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
