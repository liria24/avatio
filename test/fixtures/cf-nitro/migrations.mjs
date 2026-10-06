import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import {
    convertCloudflareMigrationHistoryCopy,
    readCommittedCloudflareMigrations,
} from '../../../scripts/cloudflareMigrationHistory.ts'

// Credentialless CI probe only. Every cf request is --local and outbound network is denied.
const execute = promisify(execFile)
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
const root = await mkdtemp(join(tmpdir(), 'avatio-cf-migrations-'))
const persistence = join(root, '.cloudflare', 'verification', 'copies', 'runtime')
const cli = join(projectRoot, 'node_modules', 'cf', 'bin', 'cf')
const files = readCommittedCloudflareMigrations()
const cutoff = files.findIndex((file) => file.name.startsWith('20260910151556_'))
const freshId = '00000000-0000-4000-8000-000000003541'
const populatedId = '00000000-0000-4000-8000-000000003542'
const cf = async (args) => {
    const result = await execute(
        process.execPath,
        [cli, ...args, '--local', '--persist-to', persistence, '--quiet'],
        {
            cwd: projectRoot,
            env: {
                PATH: process.env.PATH,
                SystemRoot: process.env.SystemRoot,
                HOME: root,
                USERPROFILE: root,
                CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
                NODE_OPTIONS: `--import ${pathToFileURL(join(projectRoot, 'test/helpers/runtimeNetwork.mjs'))}`,
            },
            maxBuffer: 8 * 1024 * 1024,
            timeout: 120_000,
        },
    )
    return JSON.parse(result.stdout)
}
const query = async (id, sql) => {
    const result = await cf(['d1', 'query', id, '--sql', sql])
    assert.ok(Array.isArray(result), 'Expected the pinned cf D1 query result array')
    assert.equal(result[0]?.success, true)
    return result[0].results
}
const migrate = (id, directory = 'drizzle') =>
    cf([
        'd1',
        'migrations',
        'apply',
        id,
        '--dir',
        directory,
        '--pattern',
        `${directory.replaceAll('\\', '/')}/*/migration.sql`,
    ])

try {
    assert.ok(cutoff > 0)
    await migrate(freshId)
    assert.deepEqual(await migrate(freshId), [])
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
    assert.deepEqual(await migrate(populatedId), [])
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
    assert.deepEqual(await query(populatedId, 'PRAGMA foreign_key_check'), [])
    console.log(
        JSON.stringify({
            pinnedCfLocalMigrations: true,
            freshDatabase: true,
            populatedSyntheticDatabase: true,
            idempotent: true,
            foreignKeysPreserved: true,
            realDataVerified: false,
            remoteMutation: false,
        }),
    )
} finally {
    // The root is created by this probe; confirm its resolved identity before recursive removal.
    const target = await realpath(root)
    const permittedParent = await realpath(tmpdir())
    assert.equal(dirname(target), permittedParent)
    assert.ok(basename(target).startsWith('avatio-cf-migrations-'))
    assert.equal(resolve(root), target)
    await rm(target, { recursive: true, force: true })
}
