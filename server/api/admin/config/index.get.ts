import { allowedBoothCategories, itemCategoryOverrides } from '@@/database/schema'
import type { AppConfig } from '@@/shared/types'
import { asc } from 'drizzle-orm'

export default adminSessionEventHandler(async ({ db, event }) => {
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
})
