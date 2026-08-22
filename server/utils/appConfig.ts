import { allowedBoothCategories, itemCategoryOverrides } from '@@/database/schema'
import { asc, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

const flagship = (event?: H3Event) => {
    const binding = getRuntimeEnv(event).FLAGS
    return binding && typeof binding === 'object' ? binding : undefined
}

const getFlag = async (key: 'is-maintenance' | 'force-update-item', event?: H3Event) => {
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
        allowedBoothCategories: Array.isArray(allowedBoothCategoryId)
            ? allowedBoothCategoryId.filter((categoryId): categoryId is number =>
                  Number.isInteger(categoryId),
              )
            : [],
        override: row?.override ?? undefined,
    }
}

export const readAppConfig = async (db: ReturnType<typeof useDB>, event: H3Event) => {
    const [categories, overrides] = await Promise.all([
        db
            .select({ categoryId: allowedBoothCategories.categoryId })
            .from(allowedBoothCategories)
            .orderBy(asc(allowedBoothCategories.categoryId)),
        db
            .select({
                platform: itemCategoryOverrides.platform,
                itemId: itemCategoryOverrides.itemId,
                category: itemCategoryOverrides.category,
            })
            .from(itemCategoryOverrides)
            .orderBy(asc(itemCategoryOverrides.platform), asc(itemCategoryOverrides.itemId)),
    ])

    const specificItemCategories: AppConfig['specificItemCategories'] = {
        booth: {},
        github: {},
    }
    for (const override of overrides)
        specificItemCategories[override.platform][override.itemId] = override.category

    return {
        allowedBoothCategoryId: categories.map(({ categoryId }) => categoryId),
        forceUpdateItem: await getForceUpdateItemFlag(event),
        isMaintenance: await getMaintenanceFlag(event),
        specificItemCategories,
    }
}
