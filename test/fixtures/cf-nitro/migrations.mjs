import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { networkInterfaces, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import {
    convertCloudflareMigrationHistoryCopy,
    readCommittedCloudflareMigrations,
} from '../../../scripts/cloudflareMigrationHistory.ts'

// Credentialless CI probe only. The workflow creates a loopback-only network namespace.
// Keep native Node networking intact so that denial instrumentation cannot affect cf/workerd.
const interfaces = networkInterfaces()
assert.equal(process.platform, 'linux')
assert.deepEqual(Object.keys(interfaces), ['lo'])
assert.ok(interfaces.lo.some((address) => address.address === '127.0.0.1'))
assert.ok(interfaces.lo.every((address) => address.internal))
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
const selection = process.argv[2] ?? 'root'
assert.ok(['root', 'fixture', 'beta6', 'wrangler'].includes(selection))
assert.ok(process.argv.length <= 3)
const wrangler = selection === 'wrangler'
const cliRoot = selection === 'root' ? projectRoot : fileURLToPath(new URL('./', import.meta.url))
const cliPackage = wrangler ? 'wrangler' : selection === 'beta6' ? 'cf-beta6' : 'cf'
const configured = JSON.parse(await readFile(join(cliRoot, 'package.json'), 'utf8'))
const installed = wrangler
    ? (await import('wrangler/package.json', { with: { type: 'json' } })).default
    : selection === 'beta6'
      ? (await import('cf-beta6/package.json', { with: { type: 'json' } })).default
      : JSON.parse(
            await readFile(join(cliRoot, 'node_modules', cliPackage, 'package.json'), 'utf8'),
        )
assert.equal(installed.version, configured.devDependencies[cliPackage].replace('npm:cf@', ''))
console.log(
    JSON.stringify({
        migrationProbeCli: wrangler ? 'wrangler' : 'cf',
        migrationProbeVersion: installed.version,
        selection,
        nodeVersion: process.version,
    }),
)
const root = await mkdtemp(join(tmpdir(), 'avatio-cf-migrations-'))
const persistence = join(root, '.cloudflare', 'verification', 'copies', 'runtime')
const cli = join(cliRoot, 'node_modules', cliPackage, 'bin', wrangler ? 'wrangler.js' : 'cf')
const files = readCommittedCloudflareMigrations()
const historyDirectory = join(root, 'history')
const cutoff = files.findIndex((file) => file.name.startsWith('20260910151556_'))
const freshId = '00000000-0000-4000-8000-000000003541'
const populatedId = '00000000-0000-4000-8000-000000003542'
let successfulCommands = 0
const run = async (args) => {
    const stdout = await new Promise((resolveOutput, reject) => {
        // cf#64 documents /dev/null; stdio ignore uses that exact OS-level stdin behavior.
        const child = spawn(
            process.execPath,
            [cli, ...args, '--local', '--persist-to', persistence],
            {
                cwd: root,
                env: {
                    PATH: process.env.PATH,
                    SystemRoot: process.env.SystemRoot,
                    HOME: root,
                    USERPROFILE: root,
                    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
                    CF_SEND_TELEMETRY: 'false',
                    ...(wrangler ? { WRANGLER_SEND_METRICS: 'false', CI: 'true' } : {}),
                },
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        )
        let output = '',
            diagnostics = ''
        const timer = setTimeout(() => child.kill('SIGTERM'), 120_000)
        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', (data) => {
            output += data
            if (Buffer.byteLength(output) > 8 * 1024 * 1024) child.kill('SIGTERM')
        })
        child.stderr.on('data', (data) => {
            diagnostics += data
            if (Buffer.byteLength(diagnostics) > 8 * 1024 * 1024) child.kill('SIGTERM')
        })
        child.once('error', (error) => {
            clearTimeout(timer)
            reject(error)
        })
        child.once('close', (code, signal) => {
            clearTimeout(timer)
            if (code !== 0)
                reject(new Error(`Pinned ${cliPackage} failed (${code ?? signal}); ${diagnostics}`))
            else {
                successfulCommands++
                resolveOutput(output)
            }
        })
    })
    return stdout
}
const wranglerConfig = async (id, directory = historyDirectory) => {
    const migrationsDir = relative(root, directory).replaceAll('\\', '/')
    assert.ok(migrationsDir && !migrationsDir.startsWith('..'))
    const config = join(root, 'wrangler.json')
    await writeFile(
        config,
        JSON.stringify({
            name: 'avatio-ci-migrations',
            compatibility_date: '2026-05-26',
            d1_databases: [
                {
                    binding: 'DATABASE',
                    database_name: 'avatio-ci-migrations',
                    database_id: id,
                    migrations_dir: migrationsDir,
                    migrations_pattern: `${migrationsDir}/*/migration.sql`,
                    migrations_table: 'd1_migrations',
                },
            ],
        }),
    )
    return config
}
const query = async (id, sql) => {
    const response = JSON.parse(
        wrangler
            ? await run([
                  'd1',
                  'execute',
                  'DATABASE',
                  '--config',
                  await wranglerConfig(id),
                  '--command',
                  sql,
                  '--json',
              ])
            : await run(['d1', 'raw', id, '--sql', sql]),
    )
    const result = Array.isArray(response) ? response : response.result
    assert.ok(Array.isArray(result), 'Expected the pinned CLI D1 query result array')
    assert.ok(result.length > 0 && result.every((entry) => entry.success === true))
    if (wrangler) {
        assert.ok(Array.isArray(result[0].results))
        return result[0].results
    }
    const { columns, rows } = result[0].results
    assert.ok(Array.isArray(columns) && Array.isArray(rows))
    return rows.map((row) =>
        Object.fromEntries(columns.map((column, index) => [column, row[index]])),
    )
}
const migrate = async (
    id,
    directory = wrangler ? historyDirectory : join(projectRoot, 'drizzle'),
) =>
    wrangler
        ? run([
              'd1',
              'migrations',
              'apply',
              'DATABASE',
              '--config',
              await wranglerConfig(id, directory),
          ])
        : run([
              'd1',
              'migrations',
              'apply',
              id,
              '--dir',
              directory,
              '--pattern',
              `${directory.replaceAll('\\', '/')}/*/migration.sql`,
          ])

// The pinned cf and Wrangler sources declare this same three-column wire contract.
const ledgerSchema = {
    columns: [
        ['id', 'INTEGER', 0, null, 1],
        ['name', 'TEXT', 0, null, 0],
        ['applied_at', 'TIMESTAMP', 1, 'CURRENT_TIMESTAMP', 0],
    ],
    autoincrement: true,
    nameUnique: true,
}
const inspectLedgerSchema = (database) => ({
    columns: database
        .prepare('PRAGMA table_info(d1_migrations)')
        .all()
        .map(({ name, type, notnull, dflt_value, pk }) => [name, type, notnull, dflt_value, pk]),
    autoincrement: /\bAUTOINCREMENT\b/i.test(
        database.prepare("SELECT sql FROM sqlite_schema WHERE name = 'd1_migrations'").get().sql,
    ),
    nameUnique: database
        .prepare('PRAGMA index_list(d1_migrations)')
        .all()
        .some((index) => {
            const columns = database
                .prepare('SELECT name FROM pragma_index_info(?)')
                .all(index.name)
            return index.unique === 1 && columns.length === 1 && columns[0].name === 'name'
        }),
})
const requireLedger = async (id) => {
    const rows = await query(id, 'SELECT id, name, applied_at FROM d1_migrations ORDER BY id')
    assert.deepEqual(
        rows.map((row) => row.name),
        files.map((file) => file.name),
    )
    assert.equal(new Set(rows.map((row) => row.name)).size, files.length)
    await migrate(id)
    assert.deepEqual(
        await query(id, 'SELECT id, name, applied_at FROM d1_migrations ORDER BY id'),
        rows,
    )
}

try {
    assert.ok(cutoff > 0)
    if (wrangler)
        for (const file of files) {
            const path = join(historyDirectory, file.name)
            await mkdir(dirname(path), { recursive: true })
            await writeFile(path, file.sql)
        }
    // cf#25: establish the empty simulator directory before its first migration.
    await mkdir(join(persistence, 'v3'), { recursive: true })
    const smoke = join(root, 'smoke')
    const smokeFile = join(smoke, '20260101000000_smoke', 'migration.sql')
    await mkdir(dirname(smokeFile), { recursive: true })
    await writeFile(
        smokeFile,
        'CREATE TABLE smoke (id INTEGER PRIMARY KEY); INSERT INTO smoke VALUES (1);',
    )
    console.log(JSON.stringify({ cfMigrationProbeStage: 'minimal-multiple-statements' }))
    await migrate('00000000-0000-4000-8000-000000003540', smoke)
    assert.deepEqual(await query('00000000-0000-4000-8000-000000003540', 'SELECT id FROM smoke'), [
        { id: 1 },
    ])
    console.log(JSON.stringify({ cfMigrationProbeStage: 'immutable-historical-sql' }))
    await migrate(freshId)
    await requireLedger(freshId)
    assert.equal(
        (await query(freshId, 'SELECT count(*) AS count FROM d1_migrations'))[0].count,
        files.length,
    )

    const prefix = join(root, 'prefix')
    for (const file of files.slice(0, cutoff)) {
        const path = join(prefix, file.name)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, file.sql)
    }
    await migrate(populatedId, prefix)
    const history = files
        .slice(0, cutoff)
        .map(
            (file, index) =>
                `INSERT INTO __alchemy_migrations (name, hash, applied_at) VALUES ('${index === 0 ? file.name : file.name.replace('/migration.sql', '')}', '${file.hash}', '2026-01-01 00:00:00');`,
        )
        .join('\n')
    await query(
        populatedId,
        `CREATE TABLE __alchemy_migrations (
        id INTEGER PRIMARY KEY, name TEXT, hash TEXT NOT NULL, applied_at TEXT
    ); ${history}
    DELETE FROM d1_migrations WHERE name != '${files[0].name}';
    INSERT INTO users (id, name, username, display_username, email)
    VALUES ('fixture-owner', 'Fixture Owner', 'fixture_owner', 'Fixture Owner', 'owner@example.invalid');
    INSERT INTO sessions (id, token, user_id, expires_at)
    VALUES ('fixture-session', 'synthetic-session', 'fixture-owner', 9999999999999);
    INSERT INTO setups (id, user_id, name) VALUES ('fixture-setup', 'fixture-owner', 'Fixture Setup');
    INSERT INTO catalog_items (id) VALUES ('fixture-item');
    INSERT INTO setup_entries (id, setup_id, item_id) VALUES ('fixture-entry', 'fixture-setup', 'fixture-item');
    INSERT INTO setup_images (id, setup_id, object_key, width, height)
    VALUES (7, 'fixture-setup', 'setup/fixture.png', 800, 600);`,
    )

    const candidates = (await readdir(persistence, { recursive: true })).filter((path) =>
        path.endsWith('.sqlite'),
    )
    let converted = false
    for (const candidate of candidates) {
        const database = new DatabaseSync(join(persistence, candidate))
        try {
            if (!database.prepare('PRAGMA table_info(__alchemy_migrations)').all().length) continue
            assert.deepEqual(inspectLedgerSchema(database), ledgerSchema)
            const oldRows = database.prepare('SELECT * FROM __alchemy_migrations').all()
            const appRows = database.prepare('SELECT * FROM setup_images').all()
            assert.equal(
                convertCloudflareMigrationHistoryCopy(database, files).importedCount,
                cutoff - 1,
            )
            assert.equal(convertCloudflareMigrationHistoryCopy(database, files).importedCount, 0)
            assert.deepEqual(database.prepare('SELECT * FROM __alchemy_migrations').all(), oldRows)
            assert.deepEqual(database.prepare('SELECT * FROM setup_images').all(), appRows)
            converted = true
        } finally {
            database.close()
        }
    }
    assert.ok(
        converted,
        'The isolated local D1 persistence must contain the synthetic populated database',
    )
    await migrate(populatedId)
    await requireLedger(populatedId)
    assert.equal(
        (await query(populatedId, 'SELECT count(*) AS count FROM __alchemy_migrations'))[0].count,
        cutoff,
    )
    assert.equal(
        (await query(populatedId, 'SELECT count(*) AS count FROM d1_migrations'))[0].count,
        files.length,
    )
    assert.equal(
        (await query(populatedId, 'SELECT token FROM sessions'))[0].token,
        'synthetic-session',
    )
    assert.equal((await query(populatedId, 'SELECT stable_id FROM setup_images'))[0].stable_id, '7')
    assert.deepEqual(await query(populatedId, 'SELECT id FROM setup_entries'), [
        { id: 'fixture-entry' },
    ])
    assert.equal((await query(populatedId, 'PRAGMA foreign_keys'))[0].foreign_keys, 1)
    assert.deepEqual(await query(populatedId, 'PRAGMA foreign_key_check'), [])
    if (wrangler) {
        const failure = join(root, 'failure')
        const failureFile = join(failure, '20260101000000_failure', 'migration.sql')
        const failureId = '00000000-0000-4000-8000-000000003543'
        await mkdir(dirname(failureFile), { recursive: true })
        await writeFile(
            failureFile,
            'CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY); INSERT INTO missing_table VALUES (1);',
        )
        await assert.rejects(() => migrate(failureId, failure), /Pinned wrangler failed \(1\)/)
        assert.deepEqual(
            await query(failureId, "SELECT name FROM sqlite_schema WHERE name = 'rollback_probe'"),
            [],
        )
        assert.equal(
            (await query(failureId, 'SELECT count(*) AS count FROM d1_migrations'))[0].count,
            0,
        )
        await writeFile(failureFile, 'CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY);')
        await migrate(failureId, failure)
        const applied = await query(failureId, 'SELECT id, name, applied_at FROM d1_migrations')
        assert.equal(applied.length, 1)
        await migrate(failureId, failure)
        assert.deepEqual(
            await query(failureId, 'SELECT id, name, applied_at FROM d1_migrations'),
            applied,
        )
    }
    console.log(
        JSON.stringify({
            pinnedCliLocalMigrations: cliPackage,
            successfulCommands,
            freshDatabase: true,
            populatedSyntheticDatabase: true,
            idempotent: true,
            foreignKeysPreserved: true,
            ledgerSchemaMatched: true,
            filenameOrderMatched: true,
            failedMigrationRolledBack: wrangler,
            cfRemoteVerified: false,
            realDataVerified: false,
            remoteMutation: false,
        }),
    )
} catch (error) {
    // Only synthetic isolated persistence exists here. Print counts rather than file paths or row values.
    for (const candidate of await readdir(persistence, { recursive: true }).catch(() => [])) {
        if (!candidate.endsWith('.sqlite')) continue
        const database = new DatabaseSync(join(persistence, candidate), { readOnly: true })
        try {
            if (database.prepare('PRAGMA table_info(d1_migrations)').all().length)
                console.log(
                    JSON.stringify({
                        syntheticAppliedMigrations: database
                            .prepare('SELECT count(*) AS count FROM d1_migrations')
                            .get().count,
                        ledgerSchemaMatches:
                            JSON.stringify(inspectLedgerSchema(database)) ===
                            JSON.stringify(ledgerSchema),
                    }),
                )
        } finally {
            database.close()
        }
    }
    throw error
} finally {
    // The root is created by this probe; confirm its resolved identity before recursive removal.
    const target = await realpath(root)
    const permittedParent = await realpath(tmpdir())
    assert.equal(dirname(target), permittedParent)
    assert.ok(basename(target).startsWith('avatio-cf-migrations-'))
    assert.equal(resolve(root), target)
    await rm(target, { recursive: true, force: true })
}
