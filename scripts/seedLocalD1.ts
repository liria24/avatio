import { Database } from 'bun:sqlite'
import { mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

import { getStageConfig } from '../config/environment'

const LOCAL_D1_DIRECTORY = join(
    process.cwd(),
    '.alchemy',
    'local',
    'd1',
    'cloudflare-runtime-D1DatabaseObject',
)

const sourceStages = ['development', 'production'] as const
type SourceStage = (typeof sourceStages)[number]

interface TableName {
    name: string
}

interface TableColumn {
    name: string
}

interface TableCount {
    count: number
}

const usage = `Usage: bun run db:seed:local -- --yes [--source development|production] [--allow-production]

Copies a remote D1 snapshot into the Alchemy/workerd database used by bun dev.

Default source: development (avatio-development)
Production source requires both --source production and --allow-production.
Authenticate Wrangler first with a D1 Read-capable account or CLOUDFLARE_API_TOKEN.
The command never creates or writes a remote D1 database.`

const isSourceStage = (value: string): value is SourceStage =>
    sourceStages.includes(value as SourceStage)

const optionValue = (name: string) => {
    const index = Bun.argv.indexOf(name)
    if (index === -1) return undefined
    const value = Bun.argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`)
    return value
}

const quoteIdentifier = (value: string) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
        throw new Error(`Unexpected SQLite identifier: ${value}`)
    return `"${value}"`
}

const quoteString = (value: string) => `'${value.replaceAll("'", "''")}'`

const appTable = (name: string) =>
    !name.startsWith('_') && !name.startsWith('sqlite_') && name !== 'd1_migrations'

const tableNames = (database: Database) =>
    (
        database
            .query(
                "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .all() as TableName[]
    ).map((table) => table.name)

const tableColumns = (database: Database, table: string) =>
    (database.query(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as TableColumn[]).map(
        (column) => column.name,
    )

const tableCount = (database: Database, table: string) =>
    (database.query(`SELECT count(*) AS count FROM ${quoteIdentifier(table)}`).get() as TableCount)
        .count

const findLocalAppDatabase = async () => {
    const candidates = (await readdir(LOCAL_D1_DIRECTORY, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sqlite'))
        .map((entry) => join(LOCAL_D1_DIRECTORY, entry.name))

    for (const candidate of candidates) {
        const database = new Database(candidate, { readonly: true })
        try {
            const tables = new Set(tableNames(database))
            if (tables.has('users') && tables.has('setups')) return candidate
        } finally {
            database.close()
        }
    }

    throw new Error(
        'Alchemy local AppDatabase was not found. Run `bun dev` once so it creates the local D1 simulator.',
    )
}

const runExport = async (sourceDatabase: string, output: string) => {
    const processHandle = Bun.spawn(
        [
            'bunx',
            'wrangler',
            'd1',
            'export',
            sourceDatabase,
            '--remote',
            '--output',
            output,
            '--skip-confirmation',
        ],
        {
            cwd: process.cwd(),
            stdin: 'inherit',
            stdout: 'pipe',
            stderr: 'pipe',
        },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
        processHandle.exited,
        new Response(processHandle.stdout).text(),
        new Response(processHandle.stderr).text(),
    ])
    if (exitCode !== 0) {
        const diagnostic = `${stdout}\n${stderr}`
            .replaceAll(/https?:\/\/\S+/g, '[redacted URL]')
            .trim()
        if (diagnostic) console.error(diagnostic)
        throw new Error(
            'D1 export failed. Authenticate Wrangler with `wrangler login` or provide a valid D1 Read-capable CLOUDFLARE_API_TOKEN.',
        )
    }
}

const createSnapshotDatabase = async (sqlPath: string, snapshotPath: string) => {
    const snapshot = new Database(snapshotPath)
    try {
        snapshot.exec(await Bun.file(sqlPath).text())
    } finally {
        snapshot.close()
    }
}

const createStagedLocalDatabase = (localPath: string, stagedPath: string) => {
    const local = new Database(localPath, { readonly: true })
    try {
        local.exec(`VACUUM INTO ${quoteString(stagedPath)}`)
    } finally {
        local.close()
    }
}

const seedStagedDatabase = (stagedPath: string, snapshotPath: string) => {
    const staged = new Database(stagedPath)
    try {
        staged.exec('PRAGMA journal_mode = DELETE')
        const targetTables = tableNames(staged).filter(appTable)
        const snapshot = new Database(snapshotPath, { readonly: true })
        let sourceTables: string[]
        let sourceColumns: Map<string, string[]>
        try {
            sourceTables = tableNames(snapshot).filter(appTable)
            sourceColumns = new Map(
                sourceTables.map((table) => [table, tableColumns(snapshot, table)]),
            )
        } finally {
            snapshot.close()
        }

        const targetTableSet = new Set(targetTables)
        const missingTargetTables = sourceTables.filter((table) => !targetTableSet.has(table))
        if (missingTargetTables.length)
            throw new Error(
                `Local schema is missing source tables: ${missingTargetTables.join(', ')}. Run the current app once before seeding.`,
            )

        staged.exec('PRAGMA foreign_keys = OFF')
        staged.exec(`ATTACH DATABASE ${quoteString(snapshotPath)} AS source_snapshot`)
        let inTransaction = false
        try {
            staged.exec('BEGIN IMMEDIATE')
            inTransaction = true

            for (const table of targetTables) staged.exec(`DELETE FROM ${quoteIdentifier(table)}`)

            for (const table of sourceTables) {
                const targetColumns = new Set(tableColumns(staged, table))
                const columns = sourceColumns
                    .get(table)!
                    .filter((column) => targetColumns.has(column))
                if (!columns.length)
                    throw new Error(`No compatible columns found for source table ${table}.`)

                const columnList = columns.map(quoteIdentifier).join(', ')
                staged.exec(
                    `INSERT INTO ${quoteIdentifier(table)} (${columnList}) SELECT ${columnList} FROM source_snapshot.${quoteIdentifier(table)}`,
                )
            }

            const foreignKeyViolations = staged.query('PRAGMA foreign_key_check').all()
            if (foreignKeyViolations.length)
                throw new Error(
                    `Foreign key verification failed with ${foreignKeyViolations.length} violation(s).`,
                )

            staged.exec('COMMIT')
            inTransaction = false
        } catch (error) {
            if (inTransaction) staged.exec('ROLLBACK')
            throw error
        } finally {
            staged.exec('DETACH DATABASE source_snapshot')
            staged.exec('PRAGMA foreign_keys = ON')
        }

        const verificationSnapshot = new Database(snapshotPath, { readonly: true })
        try {
            const copied = sourceTables.map((table) => {
                const sourceCount = tableCount(verificationSnapshot, table)
                const localCount = tableCount(staged, table)
                if (sourceCount !== localCount)
                    throw new Error(
                        `Row-count verification failed for ${table}: source=${sourceCount}, local=${localCount}.`,
                    )
                return { table, count: localCount }
            })
            return copied
        } finally {
            verificationSnapshot.close()
        }
    } finally {
        staged.close()
    }
}

const main = async () => {
    if (Bun.argv.includes('--help')) {
        console.info(usage)
        return
    }
    if (!Bun.argv.includes('--yes'))
        throw new Error(`Refusing to overwrite the local D1 database without --yes.\n\n${usage}`)

    const source = optionValue('--source') ?? 'development'
    if (!isSourceStage(source))
        throw new Error(`--source must be one of: ${sourceStages.join(', ')}.`)
    if (source === 'production' && !Bun.argv.includes('--allow-production'))
        throw new Error('Production source requires --allow-production.')

    const sourceDatabase = getStageConfig(source).infrastructure.appDatabase
    const localPath = await findLocalAppDatabase()
    const tempDirectory = await mkdtemp(join(tmpdir(), 'avatio-d1-seed-'))
    const dumpPath = join(tempDirectory, 'source.sql')
    const snapshotPath = join(tempDirectory, 'source.sqlite')
    const stagedPath = join(dirname(localPath), `${basename(localPath)}.seed`)
    const backupPath = join(dirname(localPath), `${basename(localPath)}.before-seed`)

    try {
        await runExport(sourceDatabase, dumpPath)
        await createSnapshotDatabase(dumpPath, snapshotPath)
        createStagedLocalDatabase(localPath, stagedPath)
        const copied = seedStagedDatabase(stagedPath, snapshotPath)

        await rm(backupPath, { force: true })
        await rename(localPath, backupPath)
        try {
            await rename(stagedPath, localPath)
        } catch (error) {
            await rename(backupPath, localPath)
            throw error
        }
        await Promise.all([
            rm(`${localPath}-shm`, { force: true }),
            rm(`${localPath}-wal`, { force: true }),
        ])
        await rm(backupPath, { force: true })

        const rowCount = copied.reduce((total, table) => total + table.count, 0)
        console.info(
            `Seeded ${localPath} from ${sourceDatabase}: ${rowCount} rows across ${copied.length} table(s).`,
        )
    } finally {
        await rm(stagedPath, { force: true })
        await rm(`${stagedPath}-shm`, { force: true })
        await rm(`${stagedPath}-wal`, { force: true })
        await rm(tempDirectory, { force: true, recursive: true })
    }
}

try {
    await main()
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Local D1 seed failed.')
    process.exit(1)
}
