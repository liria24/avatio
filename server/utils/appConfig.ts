import { asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { allowedBoothCategories, catalogItems } from '~~/database/schema'

export const getMaintenanceFlag = (event?: H3Event) =>
    getFeatureFlags(event).isEnabled('maintenance')

export const readAppConfig = async (db: AppDatabase, event: H3Event): Promise<AppConfig> => {
    const [categories, overrides] = await Promise.all([
        db.select().from(allowedBoothCategories).orderBy(asc(allowedBoothCategories.categoryId)),
        db
            .select({ id: catalogItems.id, category: catalogItems.categoryOverride })
            .from(catalogItems)
            .where(eq(catalogItems.categoryOverrideOrigin, 'manual'))
            .orderBy(asc(catalogItems.id)),
    ])
    return {
        allowedBoothCategoryId: categories.map(({ categoryId }) => categoryId),
        catalogCategoryOverrides: Object.fromEntries(
            overrides.flatMap(({ id, category }) => (category ? [[id, category]] : [])),
        ),
        isMaintenance: await getMaintenanceFlag(event),
    }
}
