import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type { BatchItem } from 'drizzle-orm/batch'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { getLocalAuthSecret } from '~~/config/localDevelopment'
import { relations } from '~~/database/relations'

import { setLocalDatabase } from './database'

type SyncBatchItem = BatchItem<'sqlite'> & {
    prepare(): { execute(): { sync(): unknown } }
}

interface LocalRuntime {
    secret: string
    client: DatabaseSync
    database: ReturnType<typeof drizzle<typeof relations>>
    executeBatch: (queries: BatchItem<'sqlite'>[]) => unknown[]
}

const runtimes = ((
    globalThis as typeof globalThis & { __avatioLocalRuntimes?: Map<string, LocalRuntime> }
).__avatioLocalRuntimes ??= new Map())

export const initializeLocalRuntime = (rootDirectory = process.cwd()) => {
    const existing = runtimes.get(rootDirectory)
    if (existing) {
        setLocalDatabase(existing.database, existing.executeBatch)
        return existing
    }

    const dataDirectory = join(rootDirectory, '.data')
    const databasePath = join(dataDirectory, 'avatio.sqlite')
    mkdirSync(dataDirectory, { recursive: true })
    const secret = getLocalAuthSecret(rootDirectory)
    const client = new DatabaseSync(databasePath)

    try {
        client.exec('PRAGMA journal_mode = WAL')
        client.exec('PRAGMA foreign_keys = ON')
        client.exec('PRAGMA busy_timeout = 5000')

        const database = drizzle({ client, relations })
        migrate(database, { migrationsFolder: join(rootDirectory, 'drizzle') })
        client.exec(`
            CREATE TRIGGER IF NOT EXISTS local_first_user_admin
            AFTER INSERT ON users
            WHEN (SELECT COUNT(*) FROM users) = 1
            BEGIN
                UPDATE users SET role = 'admin' WHERE id = NEW.id;
            END
        `)

        const executeBatch = (queries: BatchItem<'sqlite'>[]) =>
            database.transaction(() =>
                queries.map((query) => (query as SyncBatchItem).prepare().execute().sync()),
            )
        const runtime = { secret, client, database, executeBatch }
        runtimes.set(rootDirectory, runtime)
        setLocalDatabase(database, executeBatch)
        return runtime
    } catch (error) {
        client.close()
        throw error
    }
}
