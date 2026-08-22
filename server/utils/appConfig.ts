import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

const flagship = (event?: H3Event) => {
    const binding = getRuntimeEnv(event).FLAGS
    return binding && typeof binding === 'object' ? binding : undefined
}

export const getFlag = async (key: 'is-maintenance' | 'force-update-item', event?: H3Event) => {
    const binding = flagship(event)
    if (!binding || typeof binding.getBooleanValue !== 'function') return false
    try {
        return await binding.getBooleanValue(key, false)
    } catch {
        // Flagship is deliberately fail-closed: an outage must not disable the
        // request path or accidentally enable maintenance/update behavior.
        return false
    }
}

export const getMaintenanceFlag = (event?: H3Event) => getFlag('is-maintenance', event)

export const getForceUpdateItemFlag = (event?: H3Event) => getFlag('force-update-item', event)

// Kept as a small helper for callers that need to check an override and the
// category admission list together during one resolver pass.
export const getItemAdmission = async (
    db: ReturnType<typeof useDB>,
    platform: Platform,
    itemId: string,
) => {
    // Admission and the item-specific override are read in one D1 query. The
    // scalar subqueries keep the empty-category case represented by a row,
    // rather than requiring a second query when no category has been allowed.
    const [row] = await db.all<{
        allowed: string | null
        override: ItemCategory | null
    }>(
        sql`SELECT COALESCE((SELECT json_group_array(category_id) FROM allowed_booth_categories), '[]') AS allowed,
                   (SELECT category FROM item_category_overrides
                    WHERE platform = ${platform} AND item_id = ${itemId} LIMIT 1) AS override`,
    )

    let allowedBoothCategoryId: unknown = []
    try {
        allowedBoothCategoryId = JSON.parse(row?.allowed ?? '[]')
    } catch {
        allowedBoothCategoryId = []
    }

    return {
        allowedBoothCategories: new Set(
            Array.isArray(allowedBoothCategoryId)
                ? allowedBoothCategoryId.filter((categoryId): categoryId is number =>
                      Number.isInteger(categoryId),
                  )
                : [],
        ),
        override: row?.override ?? undefined,
    }
}
