import { resolveEffectiveCategory } from '@avatio/core/catalog'
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import {
    catalogItems,
    itemSources,
    publisherSources,
    setupEntries,
    setups,
    users,
} from '~~/database/schema'
import type { CatalogItemView } from '~~/shared/types/catalog'

export const catalogItemRelations = {
    sources: { with: { publisherSource: true } },
} as const

type CatalogRow = typeof catalogItems.$inferSelect & {
    sources: (typeof itemSources.$inferSelect & {
        publisherSource: typeof publisherSources.$inferSelect | null
    })[]
}

export const projectCatalogItem = (item: CatalogRow): CatalogItemView => {
    const source = item.sources.find((candidate) => candidate.primary)
    const publisher = source?.publisherSource
    const metadata = source?.metadata ?? {}
    const contributors = Array.isArray(metadata.contributors)
        ? metadata.contributors.flatMap((value: unknown) => {
              if (
                  !value ||
                  typeof value !== 'object' ||
                  !('name' in value) ||
                  typeof value.name !== 'string'
              )
                  return []
              return [
                  {
                      name: value.name,
                      ...('avatarUrl' in value && typeof value.avatarUrl === 'string'
                          ? { avatarUrl: value.avatarUrl }
                          : {}),
                  },
              ]
          })
        : undefined
    return {
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        name: item.displayNameOverride ?? source?.displayName ?? item.id,
        displayNameOverride: item.displayNameOverride,
        category: resolveEffectiveCategory({
            catalogOverride: item.categoryOverride,
            primarySourceCategory: source?.mappedCategory,
        }),
        image: source?.image ?? null,
        nsfw: source?.nsfw ?? false,
        primarySource: source
            ? {
                  id: source.id,
                  providerKey: source.providerKey,
                  externalId: source.externalId,
                  canonicalUrl: source.canonicalUrl,
                  availability: source.availability,
                  syncState: source.syncState,
                  price: source.price,
                  popularityCount: source.popularityCount,
                  publisher: publisher
                      ? {
                            id: publisher.id,
                            providerKey: publisher.providerKey,
                            externalId: publisher.externalId,
                            canonicalUrl: publisher.canonicalUrl,
                            name: publisher.name,
                            image: publisher.image,
                            providerVerified: publisher.providerVerified,
                        }
                      : null,
                  forks: typeof metadata.forks === 'number' ? metadata.forks : undefined,
                  version: typeof metadata.version === 'string' ? metadata.version : undefined,
                  contributors,
              }
            : null,
    }
}

export const queryCatalogItem = async (db: AppDatabase, id: string) => {
    const item = await db.query.catalogItems.findFirst({
        where: { id: { eq: id } },
        with: catalogItemRelations,
    })
    return item ? projectCatalogItem(item) : null
}

export const queryCatalogItems = async (
    db: AppDatabase,
    input: {
        q?: string
        category?: ItemCategory[]
        providerKey?: string
        availability?: CatalogSourceView['availability'][]
        orderBy?: 'createdAt' | 'name' | 'popular'
        sort?: 'asc' | 'desc'
        page?: number
        limit: number
        ownerId?: string
        publicAvatars?: boolean
        suggestedByOwnerId?: string
    },
) => {
    const page = input.page ?? 1
    const offset = (page - 1) * input.limit
    const query = input.q?.trim()
    const category = sql<ItemCategory>`coalesce(${catalogItems.categoryOverride}, ${itemSources.mappedCategory}, 'other')`
    const visibleAvatarEntries = db
        .select({ count: count() })
        .from(setupEntries)
        .innerJoin(setups, eq(setups.id, setupEntries.setupId))
        .innerJoin(users, eq(users.id, setups.userId))
        .where(
            and(
                eq(setupEntries.itemId, catalogItems.id),
                sql`coalesce(${setupEntries.categoryOverride}, ${catalogItems.categoryOverride}, ${itemSources.mappedCategory}, 'other') = 'avatar'`,
                or(eq(users.banned, false), isNull(users.banned)),
                input.ownerId
                    ? eq(setups.userId, input.ownerId)
                    : and(eq(setups.public, true), isNull(setups.hidAt)),
            ),
        )
    const visibleAvatarCount = sql<number>`(${visibleAvatarEntries})`
    const ownerEntries = db
        .select({ count: count() })
        .from(setupEntries)
        .innerJoin(setups, eq(setups.id, setupEntries.setupId))
        .where(
            and(
                eq(setupEntries.itemId, catalogItems.id),
                input.suggestedByOwnerId ? eq(setups.userId, input.suggestedByOwnerId) : undefined,
            ),
        )
    const ownerEntryCount = sql<number>`(${ownerEntries})`
    const ordering = query
        ? sql<number>`case
              when coalesce(${catalogItems.displayNameOverride}, ${itemSources.displayName}) = ${query} then 0
              when coalesce(${catalogItems.displayNameOverride}, ${itemSources.displayName}) like ${`${query}%`} then 1
              when ${publisherSources.name} = ${query} then 2
              when ${publisherSources.name} like ${`${query}%`} then 3
              else 4
          end`
        : input.suggestedByOwnerId
          ? ownerEntryCount
          : input.orderBy === 'name'
            ? sql`coalesce(${catalogItems.displayNameOverride}, ${itemSources.displayName})`
            : input.orderBy === 'popular'
              ? visibleAvatarCount
              : catalogItems.createdAt
    const data = await db
        .select({
            item: catalogItems,
            source: itemSources,
            publisher: publisherSources,
            total: sql<number>`count(*) over()`,
        })
        .from(catalogItems)
        .innerJoin(
            itemSources,
            and(eq(itemSources.itemId, catalogItems.id), eq(itemSources.primary, true)),
        )
        .leftJoin(publisherSources, eq(publisherSources.id, itemSources.publisherSourceId))
        .where(
            and(
                query
                    ? or(
                          like(itemSources.displayName, `%${query}%`),
                          like(catalogItems.displayNameOverride, `%${query}%`),
                          like(publisherSources.name, `%${query}%`),
                          like(itemSources.metadata, `%${query}%`),
                      )
                    : undefined,
                input.category?.length && !input.ownerId && !input.publicAvatars
                    ? inArray(category, input.category)
                    : undefined,
                input.providerKey ? eq(itemSources.providerKey, input.providerKey) : undefined,
                input.availability?.length
                    ? inArray(itemSources.availability, input.availability)
                    : undefined,
                input.ownerId || input.publicAvatars ? sql`${visibleAvatarCount} > 0` : undefined,
                input.suggestedByOwnerId ? sql`${ownerEntryCount} > 0` : undefined,
            ),
        )
        .orderBy(
            query ? asc(ordering) : input.sort === 'asc' ? asc(ordering) : desc(ordering),
            ...(query ? [desc(itemSources.popularityCount)] : []),
            asc(catalogItems.id),
        )
        .limit(input.limit)
        .offset(offset)
    const total = data[0]?.total ?? 0
    return {
        data: data.map((row) =>
            projectCatalogItem({
                ...row.item,
                sources: [{ ...row.source, publisherSource: row.publisher }],
            }),
        ),
        pagination: {
            page,
            limit: input.limit,
            total,
            totalPages: Math.ceil(total / input.limit),
            hasNext: offset + input.limit < total,
            hasPrev: offset > 0,
        },
    }
}
