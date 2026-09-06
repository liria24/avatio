import { z } from 'zod'
import {
    startCatalogV2Backfill,
    getCatalogMigrationRun,
    inspectCatalogV2Backfill,
    verifyCatalogV2Backfill,
} from '~~/server/migration/catalog/migration'
import { enqueueCatalogMigration } from '~~/server/migration/catalog/queue'

const log = logger('/api/admin/catalog/migration:POST')

const bodySchema = z.object({
    mode: z.enum(['dry-run', 'apply', 'verify', 'status']),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { mode } = await validateBody(bodySchema)
    setResponseHeader(event, 'Cache-Control', 'no-store')

    if (mode === 'status') return { run: await getCatalogMigrationRun(db) }
    if (mode === 'apply') {
        const run = await startCatalogV2Backfill(db)
        if (run.status === 'running') await enqueueCatalogMigration()
        setResponseStatus(event, 202)
        return { run }
    }

    const report =
        mode === 'verify' ? await verifyCatalogV2Backfill(db) : await inspectCatalogV2Backfill(db)

    log.info(
        `Catalog v2 migration ${mode}: verified=${report.verified}, issues=${report.issues.length}`,
    )
    return report
})
