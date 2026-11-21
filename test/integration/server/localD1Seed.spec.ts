import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { getPlatformProxy } from 'wrangler'

import { getLocalD1Paths } from '../../../config/localD1'
import { getLocalAuthSecret } from '../../../config/localDevelopment'
import { prepareLocalD1 } from '../../../scripts/localDevelopment'
import { seedLocalD1Snapshot } from '../../../scripts/seedLocalD1'

it('verifies a staged seed, preserves source roles and text, and retains the previous D1 on failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'avatio-seed-test-'))
    if (
        dirname(directory) !== tmpdir() ||
        !directory.startsWith(join(tmpdir(), 'avatio-seed-test-'))
    )
        throw new Error('Unsafe test root')
    let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ APP_DB: D1Database }>>> | undefined
    try {
        await cp(join(process.cwd(), 'drizzle'), join(directory, 'drizzle'), { recursive: true })
        const paths = prepareLocalD1(directory)
        const secret = getLocalAuthSecret(directory)
        const open = (path = paths.proxyPersistencePath) =>
            getPlatformProxy<{ APP_DB: D1Database }>({
                configPath: paths.configPath,
                persist: { path },
                remoteBindings: false,
            })
        proxy = await open()
        await proxy.env.APP_DB.prepare(
            "INSERT INTO catalog_items (id) VALUES ('before-seed')",
        ).run()
        await proxy.dispose()
        proxy = undefined
        const dump = join(directory, 'snapshot.sql')
        await writeFile(
            dump,
            `
            CREATE TABLE users (id TEXT, name TEXT, username TEXT, display_username TEXT, email TEXT, role TEXT, bio TEXT);
            INSERT INTO users VALUES ('source', 'Source', 'source', 'source', 'source@example.test', 'user', CAST(X'41270042e697a5' AS TEXT));
            CREATE TABLE setups (id TEXT, name TEXT, user_id TEXT);
            INSERT INTO setups VALUES ('seeded', 'Seeded', 'source');
        `,
        )
        const result = await seedLocalD1Snapshot(directory, dump)
        expect(result).toMatchObject({ rows: 2, tables: 2 })
        expect(result.backup).toBeDefined()
        expect(getLocalAuthSecret(directory)).toBe(secret)
        proxy = await open()
        expect(
            await proxy.env.APP_DB.prepare(
                "SELECT role, bio FROM users WHERE id = 'source'",
            ).first(),
        ).toEqual({ role: 'user', bio: "A'\0B日" })
        expect(
            await proxy.env.APP_DB.prepare('SELECT count(*) FROM setups').first('count(*)'),
        ).toBe(1)
        expect(
            await proxy.env.APP_DB.prepare('SELECT count(*) FROM d1_migrations').first('count(*)'),
        ).toBe(18)
        await proxy.dispose()
        proxy = await open(join(result.backup!, 'v3'))
        expect(await proxy.env.APP_DB.prepare('SELECT id FROM catalog_items').first()).toEqual({
            id: 'before-seed',
        })
        await proxy.dispose()
        proxy = undefined
        await writeFile(
            dump,
            (await readFile(dump, 'utf8')).replace("'Seeded', 'source'", "'Seeded', 'absent-user'"),
        )
        await expect(seedLocalD1Snapshot(directory, dump)).rejects.toThrow(
            /import failed|foreign key validation/,
        )
        proxy = await open(getLocalD1Paths(directory).proxyPersistencePath)
        expect(await proxy.env.APP_DB.prepare('SELECT user_id FROM setups').first()).toEqual({
            user_id: 'source',
        })
        expect(getLocalAuthSecret(directory)).toBe(secret)
    } finally {
        await proxy?.dispose()
        await rm(directory, { recursive: true, force: true })
    }
}, 120_000)
