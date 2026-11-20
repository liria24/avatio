import { join } from 'node:path'

export const getLocalD1Paths = (rootDirectory: string) => ({
    configPath: join(rootDirectory, '.data', 'wrangler.local.json'),
    persistencePath: join(rootDirectory, '.data', 'd1'),
    proxyPersistencePath: join(rootDirectory, '.data', 'd1', 'v3'),
})

export const createLocalD1Config = (rootDirectory: string) => ({
    name: 'avatio-local',
    compatibility_date: '2026-05-26',
    compatibility_flags: ['nodejs_compat'],
    d1_databases: [
        {
            binding: 'APP_DB',
            database_name: 'avatio-local',
            database_id: '00000000-0000-4000-8000-000000000001',
            migrations_dir: join(rootDirectory, 'drizzle'),
            migrations_pattern: join(rootDirectory, 'drizzle', '*', 'migration.sql').replaceAll(
                '\\',
                '/',
            ),
            migrations_table: 'd1_migrations',
        },
    ],
})
