import { relations } from 'drizzle-orm'
import {
    bigint,
    boolean,
    foreignKey,
    index,
    integer,
    pgEnum,
    pgSchema,
    pgTable,
    real,
    text,
    timestamp,
} from 'drizzle-orm/pg-core'

export const userBadge = pgEnum('user_badge', [
    'developer',
    'contributor',
    'translator',
    'alpha_tester',
    'shop_owner',
    'patrol',
    'idea_man',
])

export const itemSource = pgEnum('item_source', ['booth'])

export const itemCategory = pgEnum('item_category', [
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
])

export const authSchema = pgSchema('auth')

// export const user = authSchema.table(
//     'user',
//     {
//         id: text().primaryKey(),
//         name: text().notNull(),
//         email: text().notNull().unique(),
//         emailVerified: boolean('email_verified').default(false).notNull(),
//         image: text(),
//         createdAt: timestamp('created_at').defaultNow().notNull(),
//         updatedAt: timestamp('updated_at').defaultNow().notNull(),
//         role: text(),
//         banned: boolean(),
//         banReason: text('ban_reason'),
//         banExpires: timestamp('ban_expires'),
//         bio: text(),
//         links: text().array(),
//     },
//     (table) => [index('user_email_index').on(table.email)]
// )

// export const account = authSchema.table(
//     'account',
//     {
//         id: text().primaryKey(),
//         accountId: text('account_id').notNull(),
//         providerId: text('provider_id').notNull(),
//         userId: text('user_id')
//             .notNull()
//             .references(() => user.id, { onDelete: 'cascade' }),
//         accessToken: text('access_token'),
//         refreshToken: text('refresh_token'),
//         idToken: text('id_token'),
//         accessTokenExpiresAt: timestamp('access_token_expires_at'),
//         refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
//         scope: text(),
//         password: text(),
//         createdAt: timestamp('created_at').notNull(),
//         updatedAt: timestamp('updated_at').notNull(),
//     },
//     (table) => [index('account_user_id_index').on(table.userId)]
// )

// export const verification = authSchema.table(
//     'verification',
//     {
//         id: text().primaryKey(),
//         identifier: text().notNull(),
//         value: text().notNull(),
//         expiresAt: timestamp('expires_at').notNull(),
//         createdAt: timestamp('created_at').defaultNow().notNull(),
//         updatedAt: timestamp('updated_at').defaultNow().notNull(),
//     },
//     (table) => [index('verification_identifier_index').on(table.identifier)]
// )

export const user = authSchema.table(
    'user',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull().unique(),
        emailVerified: boolean('email_verified').default(false).notNull(),
        image: text('image'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        role: text('role'),
        banned: boolean('banned'),
        banReason: text('ban_reason'),
        banExpires: timestamp('ban_expires'),
        bio: text('bio'),
        links: text('links').array(),
    },
    (table) => [index('user_email_index').on(table.email)]
)

export const session = authSchema.table('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
})

export const account = authSchema.table(
    'account',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at'),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at').notNull(),
        updatedAt: timestamp('updated_at').notNull(),
    },
    (table) => [index('account_user_id_index').on(table.userId)]
)

export const verification = authSchema.table(
    'verification',
    {
        id: text('id').primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [index('verification_identifier_index').on(table.identifier)]
)

export const rateLimit = authSchema.table(
    'rate_limit',
    {
        id: text('id').primaryKey(),
        key: text('key'),
        count: integer('count'),
        lastRequest: bigint('last_request', { mode: 'number' }),
    },
    (table) => [index('rate_limit_key_index').on(table.key)]
)

export const userShops = authSchema.table(
    'user_shops',
    {
        id: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        shopId: text('shop_id').notNull(),
    },
    (table) => [
        index('user_shops_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_shops_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_shops_shop_id_fkey',
            columns: [table.shopId],
            foreignColumns: [shops.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const userShopVerification = authSchema.table(
    'user_shop_verification',
    {
        id: text().primaryKey(),
        code: text().notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
    },
    (table) => [
        index('user_shop_verification_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_shop_verification_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const userBadges = authSchema.table(
    'user_badges',
    {
        id: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        badge: userBadge().notNull(),
    },
    (table) => [
        index('user_badges_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_badges_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const shops = pgTable(
    'shops',
    {
        id: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        name: text().notNull(),
        image: text(),
        verified: boolean().default(false).notNull(),
    },
    (table) => [
        index('shops_id_index').on(table.id),
        index('shops_name_index').on(table.name),
    ]
)

export const items = pgTable(
    'items',
    {
        id: integer().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        source: itemSource().notNull(),
        outdated: boolean().default(false).notNull(),
        shopId: text('shop_id').notNull(),
        name: text().notNull(),
        category: itemCategory().notNull(),
        image: text(),
        price: text().notNull(),
        likes: integer().default(0).notNull(),
        nsfw: boolean().default(false).notNull(),
    },
    (table) => [
        index('items_id_index').on(table.id),
        index('items_name_index').on(table.name),
        foreignKey({
            name: 'items_shop_id_fkey',
            columns: [table.shopId],
            foreignColumns: [shops.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const tools = pgTable(
    'tools',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        name: text().notNull(),
        description: text(),
        url: text().notNull(),
        image: text(),
    },
    (table) => [
        index('tools_id_index').on(table.id),
        index('tools_name_index').on(table.name),
    ]
)

export const setups = pgTable(
    'setups',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        visibility: boolean('visibility').default(true).notNull(),
        name: text().notNull(),
        description: text(),
    },
    (table) => [
        index('setups_id_index').on(table.id),
        index('setups_user_id_index').on(table.userId),
        index('setups_name_index').on(table.name),
        foreignKey({
            name: 'setups_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupItems = pgTable(
    'setup_items',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        itemId: integer('item_id').notNull(),
        setupId: integer('setup_id').notNull(),
        category: itemCategory().notNull(),
        unsupported: boolean('unsupported').default(false).notNull(),
        note: text(),
    },
    (table) => [
        index('setup_items_id_index').on(table.id),
        index('setup_items_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'setup_items_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [items.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_items_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupItemShapekeys = pgTable(
    'setup_item_shapekeys',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupItemId: integer('setup_item_id').notNull(),
        name: text().notNull(),
        value: real().notNull(),
    },
    (table) => [
        index('setup_item_shapekeys_id_index').on(table.id),
        foreignKey({
            name: 'setup_item_shapekeys_setup_item_id_fkey',
            columns: [table.setupItemId],
            foreignColumns: [setupItems.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupTags = pgTable(
    'setup_tags',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        tag: text('tag').notNull(),
    },
    (table) => [
        index('setup_tags_id_index').on(table.id),
        index('setup_tags_setup_id_index').on(table.setupId),
        index('setup_tags_tag_index').on(table.tag),
        foreignKey({
            name: 'setup_tags_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupImages = pgTable(
    'setup_images',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        url: text().notNull(),
        width: integer().notNull(),
        height: integer().notNull(),
    },
    (table) => [
        index('setup_images_id_index').on(table.id),
        index('setup_images_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'setup_images_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupCoauthors = pgTable(
    'setup_coauthors',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        userId: text('user_id').notNull(),
        note: text(),
    },
    (table) => [
        index('setup_coauthors_id_index').on(table.id),
        index('setup_coauthors_setup_id_index').on(table.setupId),
        index('setup_coauthors_user_id_index').on(table.userId),
        foreignKey({
            name: 'setup_coauthors_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_coauthors_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupTools = pgTable(
    'setup_tools',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        toolId: integer('tool_id').notNull(),
        version: text('version'),
        note: text(),
    },
    (table) => [
        index('setup_tools_id_index').on(table.id),
        index('setup_tools_setup_id_index').on(table.setupId),
        index('setup_tools_tool_id_index').on(table.toolId),
        foreignKey({
            name: 'setup_tools_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_tools_tool_id_fkey',
            columns: [table.toolId],
            foreignColumns: [tools.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const bookmarkSchema = pgSchema('bookmark')

export const bookmarks = bookmarkSchema.table(
    'bookmarks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        setupId: integer('setup_id').notNull(),
    },
    (table) => [
        index('bookmarks_id_index').on(table.id),
        index('bookmarks_user_id_index').on(table.userId),
        index('bookmarks_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'bookmarks_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'bookmarks_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const feedbackSchema = pgSchema('feedback')

export const feedbacks = feedbackSchema.table(
    'feedbacks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        comment: text().notNull(),
        isClosed: boolean('is_closed').default(false).notNull(),
    },
    (table) => [
        index('feedbacks_id_index').on(table.id),
        index('feedbacks_user_id_index').on(table.userId),
        foreignKey({
            name: 'feedbacks_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupReports = feedbackSchema.table(
    'setup_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        reporterId: text('reporter_id').notNull(),
        setupId: integer('setup_id').notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean('bad_image').default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean('is_resolved').default(false).notNull(),
    },
    (table) => [
        index('setup_reports_id_index').on(table.id),
        index('setup_reports_setup_id_index').on(table.setupId),
        index('setup_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'setup_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_reports_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const userReports = feedbackSchema.table(
    'user_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        reporterId: text('reporter_id').notNull(),
        reporteeId: text('reportee_id').notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean('bad_image').default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean('is_resolved').default(false).notNull(),
    },
    (table) => [
        index('user_reports_id_index').on(table.id),
        index('user_reports_reporter_id_index').on(table.reporterId),
        index('user_reports_reportee_id_index').on(table.reporteeId),
        foreignKey({
            name: 'user_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_reports_reportee_id_fkey',
            columns: [table.reporteeId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const userRelations = relations(user, ({ many }) => ({
    accounts: many(account),
    shops: many(userShops),
    shopVerification: many(userShopVerification),
    badges: many(userBadges),
    setups: many(setups),
    bookmarks: many(bookmarks),
    setupCoauthors: many(setupCoauthors),
    setupReports: many(setupReports),
    feedbacks: many(feedbacks),
    userReports: many(userReports),
}))

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}))

export const verificationRelations = relations(verification, ({ one }) => ({
    user: one(user, {
        fields: [verification.identifier],
        references: [user.email],
    }),
}))

export const userShopsRelations = relations(userShops, ({ one }) => ({
    user: one(user, {
        fields: [userShops.userId],
        references: [user.id],
    }),
    shop: one(shops, {
        fields: [userShops.shopId],
        references: [shops.id],
    }),
}))

export const userShopVerificationRelations = relations(
    userShopVerification,
    ({ one }) => ({
        user: one(user, {
            fields: [userShopVerification.userId],
            references: [user.id],
        }),
    })
)

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
    user: one(user, {
        fields: [userBadges.userId],
        references: [user.id],
    }),
}))

export const shopsRelations = relations(shops, ({ many }) => ({
    items: many(items),
    userShops: many(userShops),
}))

export const itemsRelations = relations(items, ({ one, many }) => ({
    shop: one(shops, {
        fields: [items.shopId],
        references: [shops.id],
    }),
    setupItems: many(setupItems),
}))

export const toolsRelations = relations(tools, ({ many }) => ({
    setupTools: many(setupTools),
}))

export const setupsRelations = relations(setups, ({ one, many }) => ({
    user: one(user, {
        fields: [setups.userId],
        references: [user.id],
    }),
    items: many(setupItems),
    tags: many(setupTags),
    images: many(setupImages),
    coauthors: many(setupCoauthors),
    tools: many(setupTools),
    bookmarks: many(bookmarks),
    reports: many(setupReports),
}))

export const setupItemsRelations = relations(setupItems, ({ one, many }) => ({
    item: one(items, {
        fields: [setupItems.itemId],
        references: [items.id],
    }),
    setup: one(setups, {
        fields: [setupItems.setupId],
        references: [setups.id],
    }),
    shapekeys: many(setupItemShapekeys),
}))

export const setupItemShapekeysRelations = relations(
    setupItemShapekeys,
    ({ one }) => ({
        setupItem: one(setupItems, {
            fields: [setupItemShapekeys.setupItemId],
            references: [setupItems.id],
        }),
    })
)

export const setupTagsRelations = relations(setupTags, ({ one }) => ({
    setup: one(setups, {
        fields: [setupTags.setupId],
        references: [setups.id],
    }),
}))

export const setupImagesRelations = relations(setupImages, ({ one }) => ({
    setup: one(setups, {
        fields: [setupImages.setupId],
        references: [setups.id],
    }),
}))

export const setupCoauthorsRelations = relations(setupCoauthors, ({ one }) => ({
    setup: one(setups, {
        fields: [setupCoauthors.setupId],
        references: [setups.id],
    }),
    user: one(user, {
        fields: [setupCoauthors.userId],
        references: [user.id],
    }),
}))

export const setupToolsRelations = relations(setupTools, ({ one }) => ({
    setup: one(setups, {
        fields: [setupTools.setupId],
        references: [setups.id],
    }),
    tool: one(tools, {
        fields: [setupTools.toolId],
        references: [tools.id],
    }),
}))

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
    user: one(user, {
        fields: [bookmarks.userId],
        references: [user.id],
    }),
    setup: one(setups, {
        fields: [bookmarks.setupId],
        references: [setups.id],
    }),
}))

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
    user: one(user, {
        fields: [feedbacks.userId],
        references: [user.id],
    }),
}))

export const setupReportsRelations = relations(setupReports, ({ one }) => ({
    reporter: one(user, {
        fields: [setupReports.reporterId],
        references: [user.id],
    }),
    setup: one(setups, {
        fields: [setupReports.setupId],
        references: [setups.id],
    }),
}))

export const userReportsRelations = relations(userReports, ({ one }) => ({
    reporter: one(user, {
        fields: [userReports.reporterId],
        references: [user.id],
    }),
    reportee: one(user, {
        fields: [userReports.reporteeId],
        references: [user.id],
    }),
}))
