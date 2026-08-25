import { z } from 'zod'
import {
    applyCatalogV2Backfill,
    inspectCatalogV2Backfill,
    verifyCatalogV2Backfill,
} from '~~/server/migration/catalog/migration'

const log = logger('/api/admin/catalog/migration:POST')

const bodySchema = z.object({
    mode: z.enum(['dry-run', 'apply', 'verify']),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { mode } = await validateBody(bodySchema)

    const report =
        mode === 'apply'
            ? await applyCatalogV2Backfill(db)
            : mode === 'verify'
              ? await verifyCatalogV2Backfill(db)
              : await inspectCatalogV2Backfill(db)

    log.info(
        `Catalog v2 migration ${mode}: verified=${report.verified}, issues=${report.issues.length}`,
    )
    return report
})
