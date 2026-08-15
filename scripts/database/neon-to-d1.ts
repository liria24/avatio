import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const D1_DATABASE_ID = '3e7627f7-08e9-4875-875d-073c9ff0815e'
const D1_DATABASE_NAME = 'avatio'

type SourceRow = Record<string, unknown>
type WranglerResult = { results?: SourceRow[] }
type ImportProfile = 'development' | 'feature'
type TableMapping = {
    sourceSchema: string
    sourceTable: string
    targetTable: string
    transform?: (row: SourceRow) => SourceRow
}

const table = (sourceSchema: string, sourceTable: string): TableMapping => ({
    sourceSchema,
    sourceTable,
    targetTable: sourceTable,
})

const tablesBeforeRelations = [
    table('user', 'users'),
    table('user', 'sessions'),
    table('user', 'accounts'),
    table('user', 'verifications'),
    table('user', 'rate_limits'),
    table('public', 'changelogs'),
    table('public', 'shops'),
    table('public', 'items'),
    table('user', 'user_shops'),
    table('user', 'user_shop_verifications'),
    table('user', 'user_badges'),
    table('user', 'user_settings'),
]

const tablesAfterRelations = [
    table('public', 'changelog_i18ns'),
    table('public', 'changelog_authors'),
    table('public', 'setups'),
    table('public', 'setup_items'),
    table('public', 'setup_item_shapekeys'),
    table('public', 'setup_tags'),
    table('public', 'setup_images'),
    table('public', 'setup_coauthors'),
    table('user', 'setup_drafts'),
    table('user', 'setup_draft_images'),
    table('user', 'bookmarks'),
    table('user', 'notifications'),
    table('feedback', 'feedbacks'),
    table('feedback', 'item_reports'),
    table('feedback', 'setup_reports'),
    table('feedback', 'user_reports'),
    table('admin', 'audit_logs'),
    table('admin', 'emails'),
]

const developmentFollowTable: TableMapping = {
    sourceSchema: 'user',
    sourceTable: 'user_follows',
    targetTable: 'follow_users',
    transform: ({ id: _id, followee_id: followeeId, ...row }) => ({
        ...row,
        target_user_id: followeeId,
    }),
}

const profileTables: Record<ImportProfile, TableMapping[]> = {
    development: [
        ...tablesBeforeRelations,
        developmentFollowTable,
        ...tablesAfterRelations,
    ],
    feature: [
        ...tablesBeforeRelations,
        table('user', 'user_follows'),
        table('user', 'user_mutes'),
        ...tablesAfterRelations,
    ],
}

const jsonColumns = new Set([
    'users.links',
    'setup_images.theme_colors',
    'setup_drafts.content',
    'notifications.payload',
    'emails.attachments',
])

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

const sqlValue = (table: string, column: string, value: unknown) => {
    if (value === null || value === undefined) return 'NULL'
    if (
        (table === 'setup_items' && column === 'id') ||
        (table === 'setup_item_shapekeys' && column === 'setup_item_id')
    ) {
        if (!['string', 'number', 'bigint'].includes(typeof value))
            throw new Error(`Unexpected legacy setup item ID type: ${typeof value}`)
        value = `legacy:${value as string | number | bigint}`
    }
    if (value instanceof Date) return value.getTime().toString()
    if (typeof value === 'boolean') return value ? '1' : '0'
    if (typeof value === 'bigint' || typeof value === 'number') return String(value)
    if (jsonColumns.has(`${table}.${column}`) && typeof value !== 'string')
        value = JSON.stringify(value)
    if (typeof value === 'object') value = JSON.stringify(value)
    const serialized = typeof value === 'string' ? value : (JSON.stringify(value) ?? '')
    return `'${serialized.replaceAll("'", "''")}'`
}

const insertSql = (table: string, row: SourceRow) => {
    const entries = Object.entries(row)
    const columns = entries.map(([column]) => quoteIdentifier(column)).join(', ')
    const values = entries.map(([column, value]) => sqlValue(table, column, value)).join(', ')
    return `INSERT INTO ${quoteIdentifier(table)} (${columns}) VALUES (${values});`
}

const extractResults = (value: unknown): SourceRow[] => {
    if (Array.isArray(value)) {
        for (const child of value) {
            const results = extractResults(child)
            if (results.length) return results
        }
        return []
    }
    if (value && typeof value === 'object') {
        const result = value as WranglerResult
        if (Array.isArray(result.results)) return result.results
        for (const child of Object.values(result)) {
            const results = extractResults(child)
            if (results.length) return results
        }
    }
    return []
}

const main = async () => {
    const args = new Set(process.argv.slice(2))
    const profileArgument = process.argv
        .slice(2)
        .find((argument) => argument.startsWith('--profile='))
        ?.slice('--profile='.length)
    if (profileArgument !== 'development' && profileArgument !== 'feature')
        throw new Error('Pass --profile=development or --profile=feature.')
    const profile: ImportProfile = profileArgument
    const tables = profileTables[profile]
    const suppliedId = process.argv
        .slice(2)
        .find((argument) => argument.startsWith('--database-id='))
        ?.slice('--database-id='.length)

    if (!args.has('--remote') || !args.has('--reset-target') || suppliedId !== D1_DATABASE_ID)
        throw new Error(
            `Refusing to run. Pass --remote --reset-target --database-id=${D1_DATABASE_ID}.`,
        )

    const neonUrl = process.env.NEON_DATABASE_URL
    if (!neonUrl) throw new Error('NEON_DATABASE_URL is required for the one-time import.')

    const repositoryRoot = resolve(import.meta.dir, '..', '..')
    const wranglerConfig = JSON.parse(
        await Bun.file(resolve(repositoryRoot, 'wrangler.jsonc')).text(),
    ) as { d1_databases?: { binding?: string; database_id?: string }[] }
    const configuredDatabase = wranglerConfig.d1_databases?.find(
        (database) => database.binding === 'APP_DB',
    )
    if (configuredDatabase?.database_id !== D1_DATABASE_ID)
        throw new Error('The APP_DB ID in wrangler.jsonc does not match the guarded D1 ID.')

    const source = new Bun.SQL(neonUrl)
    const sourceRows = new Map<string, SourceRow[]>()

    try {
        for (const mapping of tables) {
            const rows = (await source.unsafe(
                `SELECT * FROM ${quoteIdentifier(mapping.sourceSchema)}.${quoteIdentifier(mapping.sourceTable)} ORDER BY 1`,
            )) as SourceRow[]
            sourceRows.set(
                mapping.targetTable,
                mapping.transform ? rows.map(mapping.transform) : rows,
            )
        }
    } finally {
        await source.close()
    }

    const temporaryDirectory = resolve(repositoryRoot, '.wrangler', 'migration-import')
    await mkdir(temporaryDirectory, { recursive: true })
    const resetFile = resolve(temporaryDirectory, 'reset.sql')
    const importFile = resolve(temporaryDirectory, 'import.sql')
    const reverseTables = [...tables].reverse()
    await Bun.write(
        resetFile,
        reverseTables
            .map(({ targetTable }) => `DELETE FROM ${quoteIdentifier(targetTable)};`)
            .join('\n'),
    )
    await Bun.write(
        importFile,
        tables
            .flatMap(({ targetTable }) =>
                (sourceRows.get(targetTable) ?? []).map((row) => insertSql(targetTable, row)),
            )
            .join('\n'),
    )

    const runWrangler = async (arguments_: string[], capture = false) => {
        const child = Bun.spawn([process.execPath, 'x', 'wrangler', ...arguments_], {
            cwd: repositoryRoot,
            stdout: capture ? 'pipe' : 'inherit',
            stderr: 'inherit',
        })
        const output = capture ? await new Response(child.stdout).text() : ''
        const exitCode = await child.exited
        if (exitCode !== 0) throw new Error(`Wrangler exited with code ${exitCode}.`)
        return output
    }

    try {
        await runWrangler(['d1', 'execute', D1_DATABASE_NAME, '--remote', '--file', resetFile])
        await runWrangler(['d1', 'execute', D1_DATABASE_NAME, '--remote', '--file', importFile])

        const countQuery = tables
            .map(
                ({ targetTable }) =>
                    `SELECT '${targetTable}' AS table_name, COUNT(*) AS row_count FROM ${quoteIdentifier(targetTable)}`,
            )
            .join(' UNION ALL ')
        const countOutput = await runWrangler(
            ['d1', 'execute', D1_DATABASE_NAME, '--remote', '--json', '--command', countQuery],
            true,
        )
        const targetCounts = new Map(
            extractResults(JSON.parse(countOutput)).map((row) => [
                String(row.table_name),
                Number(row.row_count),
            ]),
        )
        const mismatches = tables.flatMap(({ targetTable }) => {
            const sourceCount = sourceRows.get(targetTable)?.length ?? 0
            const targetCount = targetCounts.get(targetTable)
            return targetCount === sourceCount
                ? []
                : [`${targetTable}: Neon=${sourceCount}, D1=${targetCount ?? 'missing'}`]
        })
        if (mismatches.length)
            throw new Error(`Row count verification failed:\n${mismatches.join('\n')}`)

        const foreignKeyOutput = await runWrangler(
            [
                'd1',
                'execute',
                D1_DATABASE_NAME,
                '--remote',
                '--json',
                '--command',
                'PRAGMA foreign_key_check;',
            ],
            true,
        )
        if (extractResults(JSON.parse(foreignKeyOutput)).length)
            throw new Error('D1 foreign_key_check returned violations.')

        const integrityOutput = await runWrangler(
            [
                'd1',
                'execute',
                D1_DATABASE_NAME,
                '--remote',
                '--json',
                '--command',
                'PRAGMA integrity_check;',
            ],
            true,
        )
        const integrityRows = extractResults(JSON.parse(integrityOutput))
        if (!integrityRows.some((row) => Object.values(row).includes('ok')))
            throw new Error('SQLite integrity_check did not return ok.')

        const total = [...sourceRows.values()].reduce((sum, rows) => sum + rows.length, 0)
        console.log(
            `Imported and verified the ${profile} profile: ${tables.length} tables and ${total} rows.`,
        )
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
    }
}

await main()
