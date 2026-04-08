import { defineRelations } from 'drizzle-orm'

import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
    users: {
        accounts: r.many.accounts({
            from: r.users.id,
            to: r.accounts.userId,
        }),
        shops: r.many.userShops({
            from: r.users.id,
            to: r.userShops.userId,
        }),
        shopVerifications: r.many.userShopVerifications({
            from: r.users.id,
            to: r.userShopVerifications.userId,
        }),
        badges: r.many.userBadges({
            from: r.users.id,
            to: r.userBadges.userId,
        }),
        settings: r.one.userSettings({
            from: r.users.id,
            to: r.userSettings.userId,
        }),
        setupCoauthors: r.many.setupCoauthors({
            from: r.users.id,
            to: r.setupCoauthors.userId,
        }),
        setups: r.many.setups({
            from: r.users.id,
            to: r.setups.userId,
        }),
        bookmarks: r.many.bookmarks({
            from: r.users.id,
            to: r.bookmarks.userId,
        }),
        notifications: r.many.notifications({
            from: r.users.id,
            to: r.notifications.userId,
        }),
        itemReports: r.many.itemReports({
            from: r.users.id,
            to: r.itemReports.reporterId,
        }),
        setupReports: r.many.setupReports({
            from: r.users.id,
            to: r.setupReports.reporterId,
        }),
        userReports: r.many.userReports({
            from: r.users.id,
            to: r.userReports.reporterId,
        }),
        auditLogs: r.many.auditLogs({
            from: r.users.id,
            to: r.auditLogs.userId,
        }),
        changelogs: r.many.changelogAuthors({
            from: r.users.id,
            to: r.changelogAuthors.userId,
        }),
        drafts: r.many.setupDrafts({
            from: r.users.id,
            to: r.setupDrafts.userId,
        }),
        follows: r.many.followUsers({
            from: r.users.id,
            to: r.followUsers.userId,
        }),
        followers: r.many.followUsers({
            from: r.users.id,
            to: r.followUsers.targetUserId,
        }),
    },
    accounts: {
        user: r.one.users({
            from: r.accounts.userId,
            to: r.users.id,
        }),
    },
    changelogs: {
        i18n: r.many.changelogI18ns({
            from: r.changelogs.slug,
            to: r.changelogI18ns.changelogSlug,
        }),
        authors: r.many.changelogAuthors({
            from: r.changelogs.slug,
            to: r.changelogAuthors.changelogSlug,
        }),
    },
    changelogI18ns: {
        changelog: r.one.changelogs({
            from: r.changelogI18ns.changelogSlug,
            to: r.changelogs.slug,
            optional: false,
        }),
    },
    changelogAuthors: {
        changelog: r.one.changelogs({
            from: r.changelogAuthors.changelogSlug,
            to: r.changelogs.slug,
            optional: false,
        }),
        user: r.one.users({
            from: r.changelogAuthors.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    userSettings: {
        user: r.one.users({
            from: r.userSettings.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    userShops: {
        user: r.one.users({
            from: r.userShops.userId,
            to: r.users.id,
            optional: false,
        }),
        shop: r.one.shops({
            from: r.userShops.shopId,
            to: r.shops.id,
            optional: false,
        }),
    },
    userShopVerifications: {
        user: r.one.users({
            from: r.userShopVerifications.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    userBadges: {
        user: r.one.users({
            from: r.userBadges.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    shops: {
        items: r.many.items({
            from: r.shops.id,
            to: r.items.shopId,
        }),
        userShops: r.many.userShops({
            from: r.shops.id,
            to: r.userShops.shopId,
        }),
    },
    items: {
        shop: r.one.shops({
            from: r.items.shopId,
            to: r.shops.id,
            optional: false,
        }),
        setupItems: r.many.setupItems({
            from: r.items.id,
            to: r.setupItems.itemId,
        }),
    },
    setups: {
        user: r.one.users({
            from: r.setups.userId,
            to: r.users.id,
            optional: false,
        }),
        items: r.many.setupItems({
            from: r.setups.id,
            to: r.setupItems.setupId,
        }),
        tags: r.many.setupTags({
            from: r.setups.id,
            to: r.setupTags.setupId,
        }),
        images: r.many.setupImages({
            from: r.setups.id,
            to: r.setupImages.setupId,
        }),
        coauthors: r.many.setupCoauthors({
            from: r.setups.id,
            to: r.setupCoauthors.setupId,
        }),
        bookmarks: r.many.bookmarks({
            from: r.setups.id,
            to: r.bookmarks.setupId,
        }),
        reports: r.many.setupReports({
            from: r.setups.id,
            to: r.setupReports.setupId,
        }),
    },
    setupItems: {
        item: r.one.items({
            from: r.setupItems.itemId,
            to: r.items.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.setupItems.setupId,
            to: r.setups.id,
            optional: false,
        }),
        shapekeys: r.many.setupItemShapekeys({
            from: r.setupItems.id,
            to: r.setupItemShapekeys.setupItemId,
        }),
    },
    setupItemShapekeys: {
        setupItem: r.one.setupItems({
            from: r.setupItemShapekeys.setupItemId,
            to: r.setupItems.id,
            optional: false,
        }),
    },
    setupTags: {
        setup: r.one.setups({
            from: r.setupTags.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    setupImages: {
        setup: r.one.setups({
            from: r.setupImages.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    setupCoauthors: {
        setup: r.one.setups({
            from: r.setupCoauthors.setupId,
            to: r.setups.id,
            optional: false,
        }),
        user: r.one.users({
            from: r.setupCoauthors.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    followUsers: {
        user: r.one.users({
            from: r.followUsers.userId,
            to: r.users.id,
            optional: false,
        }),
        targetUser: r.one.users({
            from: r.followUsers.targetUserId,
            to: r.users.id,
            optional: false,
        }),
    },
    setupDrafts: {
        user: r.one.users({
            from: r.setupDrafts.userId,
            to: r.users.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.setupDrafts.setupId,
            to: r.setups.id,
        }),
    },
    bookmarks: {
        user: r.one.users({
            from: r.bookmarks.userId,
            to: r.users.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.bookmarks.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    notifications: {
        user: r.one.users({
            from: r.notifications.userId,
            to: r.users.id,
            optional: false,
        }),
    },
    itemReports: {
        reporter: r.one.users({
            from: r.itemReports.reporterId,
            to: r.users.id,
            optional: false,
        }),
        item: r.one.items({
            from: r.itemReports.itemId,
            to: r.items.id,
            optional: false,
        }),
    },
    setupReports: {
        reporter: r.one.users({
            from: r.setupReports.reporterId,
            to: r.users.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.setupReports.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    userReports: {
        reporter: r.one.users({
            from: r.userReports.reporterId,
            to: r.users.id,
            optional: false,
        }),
        reportee: r.one.users({
            from: r.userReports.reporteeId,
            to: r.users.id,
            optional: false,
        }),
    },
    auditLogs: {
        user: r.one.users({
            from: r.auditLogs.userId,
            to: r.users.id,
            optional: false,
        }),
    },
}))
