import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

interface MigrationFile {
    name: string
    hash: string
}
interface AlchemyMigration {
    name: string
    hash: string
    appliedAt: string
}
const fileName = /^\d{14}_[\w-]+\/migration\.sql$/
const hashPattern = /^[a-f0-9]{64}$/

/** One-time bookkeeping translation. It never marks an unrecorded SQL file applied. */
export const mapCloudflareMigrationHistory = (
    files: readonly MigrationFile[],
    alchemy: readonly AlchemyMigration[],
    cloudflare: readonly { name: string }[],
) => {
    const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name))
    const known = new Map(ordered.map((file) => [file.name, file.hash]))
    if (
        known.size !== files.length ||
        files.some((file) => !fileName.test(file.name) || !hashPattern.test(file.hash))
    )
        throw new Error('Invalid or duplicate committed migration files.')
    const applied = new Map<string, AlchemyMigration>()
    for (const row of alchemy) {
        const name = row.name.endsWith('/migration.sql') ? row.name : `${row.name}/migration.sql`
        if (
            !fileName.test(name) ||
            known.get(name) !== row.hash ||
            !row.appliedAt ||
            applied.has(name)
        )
            throw new Error('Alchemy history is unknown, changed, incomplete, or duplicated.')
        applied.set(name, { ...row, name })
    }
    if (ordered.some((file, index) => applied.has(file.name) !== index < applied.size))
        throw new Error('Applied migrations must be a contiguous prefix of committed files.')
    const retained = new Set<string>()
    for (const row of cloudflare) {
        if (!applied.has(row.name) || retained.has(row.name))
            throw new Error('Cloudflare history conflicts with verified Alchemy history.')
        retained.add(row.name)
    }
    return {
        imports: [...applied.values()].filter((row) => !retained.has(row.name)),
        pending: ordered.filter((file) => !applied.has(file.name)).map((file) => file.name),
    }
}

const requiredString = (value: unknown): string => {
    if (typeof value !== 'string' || !value) throw new Error('Invalid migration ledger value.')
    return value
}

/** For isolated SQLite copies/tests only; no remote client or application migration execution. */
export const convertCloudflareMigrationHistoryCopy = (
    database: DatabaseSync,
    files: readonly MigrationFile[],
) => {
    database.exec('PRAGMA foreign_keys = ON')
    if (
        database
            .prepare('PRAGMA quick_check')
            .all()
            .some((row) => row.quick_check !== 'ok')
    )
        throw new Error('Copy failed SQLite integrity validation before bookkeeping conversion.')
    if (database.prepare('PRAGMA foreign_key_check').all().length > 0)
        throw new Error('Copy has foreign-key violations before bookkeeping conversion.')
    const columns = database.prepare('PRAGMA table_info("__alchemy_migrations")').all()
    if (
        !['name', 'hash', 'applied_at'].every((name) =>
            columns.some((column) => column.name === name),
        )
    )
        throw new Error('The isolated copy requires the verified Alchemy ledger layout.')
    const currentColumns = database.prepare('PRAGMA table_info("d1_migrations")').all()
    if (
        currentColumns.length &&
        (currentColumns.length !== 3 ||
            !['id', 'name', 'applied_at'].every((name) =>
                currentColumns.some((column) => column.name === name),
            ))
    )
        throw new Error('The copy has an unexpected Cloudflare ledger layout.')
    if (
        database
            .prepare(
                "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'd1_migrations'",
            )
            .all().length
    )
        throw new Error('Unexpected triggers on the Cloudflare bookkeeping table.')
    const alchemy = database
        .prepare('SELECT name, hash, applied_at FROM "__alchemy_migrations" ORDER BY id')
        .all()
        .map((row) => ({
            name: requiredString(row.name),
            hash: requiredString(row.hash),
            appliedAt: requiredString(row.applied_at),
        }))
    const cloudflare = currentColumns.length
        ? database
              .prepare('SELECT name FROM "d1_migrations" ORDER BY id')
              .all()
              .map((row) => ({ name: requiredString(row.name) }))
        : []
    const mapping = mapCloudflareMigrationHistory(files, alchemy, cloudflare)
    database.exec('BEGIN IMMEDIATE')
    try {
        database.exec(`CREATE TABLE IF NOT EXISTS "d1_migrations" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`)
        const insert = database.prepare(
            'INSERT INTO "d1_migrations" (name, applied_at) VALUES (?, ?)',
        )
        for (const row of mapping.imports) insert.run(row.name, row.appliedAt)
        if (database.prepare('PRAGMA foreign_key_check').all().length)
            throw new Error('Copy bookkeeping conversion failed foreign-key validation.')
        database.exec('COMMIT')
    } catch (error) {
        database.exec('ROLLBACK')
        throw error
    }
    return { importedCount: mapping.imports.length, pendingCount: mapping.pending.length }
}

export const readCommittedCloudflareMigrations = () => {
    execFileSync('git', ['diff', '--exit-code', '--quiet', 'HEAD', '--', 'drizzle'])
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'drizzle'], {
        encoding: 'utf8',
    })
        .trim()
        .split('\n')
        .filter((path) => path.endsWith('/migration.sql'))
        .sort()
    return paths.map((path) => {
        const sql = execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' })
        return {
            name: path.slice('drizzle/'.length),
            hash: createHash('sha256').update(sql).digest('hex'),
            sql,
        }
    })
}

/** Reject the live local database, symlink/hardlink aliases and changed copies before opening SQLite. */
export const requireIsolatedMigrationCopy = (
    path: string,
    expectedHash: string,
    workspace = process.cwd(),
) => {
    const intendedRoot = resolve(workspace, '.cloudflare', 'verification', 'copies')
    const root = realpathSync(intendedRoot)
    const target = realpathSync(path)
    const within = relative(root, target)
    if (
        relative(intendedRoot, root) !== '' ||
        !within ||
        within.startsWith('..') ||
        isAbsolute(within) ||
        !target.endsWith('.sqlite') ||
        statSync(target).nlink !== 1 ||
        ['-wal', '-shm', '-journal'].some((suffix) => existsSync(`${target}${suffix}`)) ||
        !hashPattern.test(expectedHash) ||
        createHash('sha256').update(readFileSync(target)).digest('hex') !== expectedHash
    )
        throw new Error(
            'Expected an unchanged standalone copy under the private verification directory.',
        )
    return target
}

if (import.meta.main) {
    let database: DatabaseSync | undefined
    try {
        const [path, hash, extra] = process.argv.slice(2)
        if (!path || !hash || extra)
            throw new Error('Expected an isolated copy and its verified checksum.')
        const target = requireIsolatedMigrationCopy(path, hash)
        const files = readCommittedCloudflareMigrations()
        database = new DatabaseSync(target)
        const result = convertCloudflareMigrationHistoryCopy(database, files)
        console.log(JSON.stringify({ isolatedCopyOnly: true, remoteMutation: false, ...result }))
    } catch {
        console.error('Isolated migration-history conversion stopped; private details are omitted.')
        process.exitCode = 1
    } finally {
        database?.close()
    }
}
