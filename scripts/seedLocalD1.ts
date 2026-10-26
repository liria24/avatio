import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import type { D1Database } from '@cloudflare/workers-types'
import { getPlatformProxy } from 'wrangler'

import { getStageConfig } from '../config/environment.ts'
import { getLocalD1Paths } from '../config/localD1.ts'
import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'
import { prepareLocalD1, requireLocalDevelopmentPort } from './localDevelopment.ts'

const wrangler = fileURLToPath(new URL('../bin/wrangler.js', import.meta.resolve('wrangler')))
const usage = `Usage: vp run db:seed:local -- --yes [--source development|production] [--allow-production]

Copies a remote D1 snapshot into local D1. Stop the local app first.
The previous local D1 directory is retained as a timestamped backup under .data/.
Production requires --source production and --allow-production.
Authenticate Wrangler with D1 Read permission. This command never writes remote D1.`

const identifier = (name: string) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Unexpected database identifier.')
    return `"${name}"`
}
const appTable = (name: string) =>
    !name.startsWith('_') && !name.startsWith('sqlite_') && name !== 'd1_migrations'

// Only the official D1 binding/CLI touches persistence; SQLite reads the exported snapshot in memory.
export const seedLocalD1Snapshot = async (rootDirectory: string, dumpPath: string) => {
    const parent = resolve(rootDirectory, '.data')
    await mkdir(parent, { recursive: true })
    const staging = await mkdtemp(join(parent, 'd1-seed-'))
    if (dirname(staging) !== parent || !staging.startsWith(join(parent, 'd1-seed-')))
        throw new Error('Unsafe local D1 staging path.')
    const snapshot = new DatabaseSync(':memory:')
    let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ APP_DB: D1Database }>>> | undefined
    try {
        snapshot.exec(await readFile(dumpPath, 'utf8'))
        await cp(join(rootDirectory, 'drizzle'), join(staging, 'drizzle'), { recursive: true })
        const paths = prepareLocalD1(staging)
        proxy = await getPlatformProxy<{ APP_DB: D1Database }>({
            configPath: paths.configPath,
            persist: { path: paths.proxyPersistencePath },
            remoteBindings: false,
        })
        const db = proxy.env.APP_DB
        const targetTables = (
            await db
                .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
                .all<{ name: string }>()
        ).results
            .map((row) => row.name)
            .filter(appTable)
        const sourceTables = snapshot
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
            .all()
            .map((row) => String(row.name))
            .filter(appTable)
        if (!sourceTables.includes('users') || !sourceTables.includes('setups'))
            throw new Error('The snapshot is not an Avatio application database.')
        const sql = [
            'PRAGMA defer_foreign_keys = ON;',
            'DROP TRIGGER local_first_user_admin;',
            ...targetTables.map((table) => `DELETE FROM ${identifier(table)};`),
        ]
        const counts = new Map<string, number>()
        for (const table of sourceTables) {
            if (!targetTables.includes(table))
                throw new Error(`Local schema is missing source table ${table}.`)
            const columns = snapshot
                .prepare(`PRAGMA table_info(${identifier(table)})`)
                .all()
                .map((row) => String(row.name))
            const targetColumns = (
                await db.prepare(`PRAGMA table_info(${identifier(table)})`).all<{ name: string }>()
            ).results.map((row) => row.name)
            if (columns.some((column) => !targetColumns.includes(column)))
                throw new Error(`Local schema is missing source columns in ${table}.`)
            const columnList = columns.map(identifier).join(', ')
            // Hex text preserves embedded NULs that SQLite quote() would truncate.
            const values = columns
                .map(identifier)
                .map(
                    (column) =>
                        `CASE typeof(${column}) WHEN 'text' THEN 'CAST(X''' || hex(${column}) || ''' AS TEXT)' ELSE quote(${column}) END`,
                )
                .join(" || ',' || ")
            const rows = snapshot
                .prepare(`SELECT ${values} AS data FROM ${identifier(table)}`)
                .all()
            counts.set(table, rows.length)
            for (const row of rows)
                sql.push(
                    `INSERT INTO ${identifier(table)} (${columnList}) VALUES (${String(row.data)});`,
                )
        }
        await proxy.dispose()
        proxy = undefined
        const importPath = join(staging, 'data.sql')
        await writeFile(importPath, sql.join('\n'), { mode: 0o600 })
        const environment = createCloudflareProcessEnvironment(
            process.env,
            join(staging, '.data/tooling-home'),
        )
        try {
            execFileSync(
                process.execPath,
                [
                    wrangler,
                    'd1',
                    'execute',
                    'APP_DB',
                    '--local',
                    '--config',
                    paths.configPath,
                    '--persist-to',
                    paths.persistencePath,
                    '--file',
                    importPath,
                ],
                {
                    cwd: staging,
                    env: { ...environment, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
                    stdio: 'pipe',
                },
            )
        } catch {
            throw new Error('Local D1 import failed; the previous local database is unchanged.')
        }
        prepareLocalD1(staging)
        proxy = await getPlatformProxy<{ APP_DB: D1Database }>({
            configPath: paths.configPath,
            persist: { path: paths.proxyPersistencePath },
            remoteBindings: false,
        })
        if ((await proxy.env.APP_DB.prepare('PRAGMA foreign_key_check').all()).results.length)
            throw new Error('Snapshot foreign key validation failed.')
        for (const [table, expected] of counts) {
            const actual = await proxy.env.APP_DB.prepare(
                `SELECT count(*) AS count FROM ${identifier(table)}`,
            ).first<number>('count')
            if (actual !== expected) throw new Error(`Row-count verification failed for ${table}.`)
        }
        await proxy.dispose()
        proxy = undefined
        await requireLocalDevelopmentPort()
        const target = getLocalD1Paths(resolve(rootDirectory)).persistencePath
        const backup = join(parent, `d1-before-seed-${Date.now()}`)
        if (
            dirname(target) !== parent ||
            dirname(backup) !== parent ||
            dirname(paths.persistencePath) !== join(staging, '.data')
        )
            throw new Error('Unsafe local D1 replacement path.')
        let retained = false
        try {
            await rename(target, backup)
            retained = true
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        try {
            await rename(paths.persistencePath, target)
        } catch (error) {
            if (retained) await rename(backup, target)
            throw error
        }
        return {
            rows: [...counts.values()].reduce((sum, count) => sum + count, 0),
            tables: counts.size,
            backup: retained ? backup : undefined,
        }
    } finally {
        snapshot.close()
        await proxy?.dispose()
        await rm(staging, { recursive: true, force: true })
    }
}

const main = async () => {
    if (process.argv.includes('--help')) return console.info(usage)
    if (!process.argv.includes('--yes'))
        throw new Error(`Local replacement requires --yes.\n${usage}`)
    const sourceIndex = process.argv.indexOf('--source')
    const source = sourceIndex === -1 ? 'development' : process.argv[sourceIndex + 1]
    if (source !== 'development' && source !== 'production')
        throw new Error('--source must be development or production.')
    if (source === 'production' && !process.argv.includes('--allow-production'))
        throw new Error('Production source requires --allow-production.')
    await requireLocalDevelopmentPort()
    const root = process.cwd()
    const parent = resolve(root, '.data')
    await mkdir(parent, { recursive: true })
    const directory = await mkdtemp(join(parent, 'd1-export-'))
    if (dirname(directory) !== parent || !directory.startsWith(join(parent, 'd1-export-')))
        throw new Error('Unsafe export path.')
    const dump = join(directory, 'source.sql')
    try {
        try {
            execFileSync(
                process.execPath,
                [
                    wrangler,
                    'd1',
                    'export',
                    getStageConfig(source).infrastructure.appDatabase,
                    '--remote',
                    '--output',
                    dump,
                    '--skip-confirmation',
                ],
                { stdio: 'pipe' },
            )
        } catch {
            throw new Error(
                'Remote D1 export failed. Authenticate Wrangler with D1 Read permission.',
            )
        }
        const result = await seedLocalD1Snapshot(root, dump)
        console.info(
            `Seeded local D1: ${result.rows} rows across ${result.tables} tables.${result.backup ? ` Previous data: ${result.backup}` : ''}`,
        )
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

if (import.meta.main) {
    try {
        await main()
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'Local D1 seed failed.')
        process.exitCode = 1
    }
}
