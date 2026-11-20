import { loadEnv } from 'vite-plus'
import { defineConfig } from 'vitest/config'

const env = loadEnv('test', process.cwd(), '')

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
                    exclude: [
                        'test/unit/cloudflareBuild.spec.ts',
                        'test/unit/cloudflareConfiguration.spec.ts',
                        'test/unit/cloudflareMigrationHistory.spec.ts',
                        'test/unit/cloudflareWorkflow.spec.ts',
                        'test/unit/configuration.spec.ts',
                        'test/unit/installDependencies.spec.ts',
                        'test/unit/localDevelopment.spec.ts',
                    ],
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
                    exclude: [
                        'test/integration/cloudflareMigrationHistory.spec.ts',
                        'test/integration/configuration.spec.ts',
                        'test/integration/server/authUniqueIndexes.spec.ts',
                        'test/integration/server/d1Migration.spec.ts',
                        'test/integration/server/localD1Seed.spec.ts',
                        'test/integration/server/localRuntime.spec.ts',
                        'test/integration/server/setupImageMigration.spec.ts',
                    ],
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test/setup.ts'],
                    env,
                },
            },
        ],
    },
})
