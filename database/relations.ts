import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
    user: {
        accounts: r.many.account({
            from: r.user.id,
            to: r.account.userId,
        }),
        sessions: r.many.session({
            from: r.user.id,
            to: r.session.userId,
        }),
        shops: r.many.userShops({
            from: r.user.id,
            to: r.userShops.userId,
        }),
        shopVerifications: r.many.userShopVerification({
            from: r.user.id,
            to: r.userShopVerification.userId,
        }),
        badges: r.many.userBadges({
            from: r.user.id,
            to: r.userBadges.userId,
        }),
        setupCoauthors: r.many.setupCoauthors({
            from: r.user.id,
            to: r.setupCoauthors.userId,
        }),
        setups: r.many.setups({
            from: r.user.id,
            to: r.setups.userId,
        }),
        bookmarks: r.many.bookmarks({
            from: r.user.id,
            to: r.bookmarks.userId,
        }),
        notifications: r.many.notifications({
            from: r.user.id,
            to: r.notifications.userId,
        }),
        itemReports: r.many.itemReports({
            from: r.user.id,
            to: r.itemReports.reporterId,
        }),
        setupReports: r.many.setupReports({
            from: r.user.id,
            to: r.setupReports.reporterId,
        }),
        userReports: r.many.userReports({
            from: r.user.id,
            to: r.userReports.reporterId,
        }),
        auditLogs: r.many.auditLogs({
            from: r.user.id,
            to: r.auditLogs.userId,
        }),
        changelogs: r.many.changelogAuthors({
            from: r.user.id,
            to: r.changelogAuthors.userId,
        }),
        drafts: r.many.setupDrafts({
            from: r.user.id,
            to: r.setupDrafts.userId,
        }),
        follows: r.many.followUsers({
            from: r.user.id,
            to: r.followUsers.userId,
        }),
        followers: r.many.followUsers({
            from: r.user.id,
            to: r.followUsers.targetUserId,
        }),
    },
    account: {
        user: r.one.user({
            from: r.account.userId,
            to: r.user.id,
        }),
    },
    verification: {
        user: r.one.user({
            from: r.verification.identifier,
            to: r.user.email,
        }),
    },
    changelogs: {
        authors: r.many.changelogAuthors({
            from: r.changelogs.slug,
            to: r.changelogAuthors.changelogSlug,
        }),
    },
    changelogAuthors: {
        changelog: r.one.changelogs({
            from: r.changelogAuthors.changelogSlug,
            to: r.changelogs.slug,
            optional: false,
        }),
        user: r.one.user({
            from: r.changelogAuthors.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    userShops: {
        user: r.one.user({
            from: r.userShops.userId,
            to: r.user.id,
            optional: false,
        }),
        shop: r.one.shops({
            from: r.userShops.shopId,
            to: r.shops.id,
            optional: false,
        }),
    },
    userShopVerification: {
        user: r.one.user({
            from: r.userShopVerification.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    userBadges: {
        user: r.one.user({
            from: r.userBadges.userId,
            to: r.user.id,
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
        user: r.one.user({
            from: r.setups.userId,
            to: r.user.id,
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
        user: r.one.user({
            from: r.setupCoauthors.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    followUsers: {
        user: r.one.user({
            from: r.followUsers.userId,
            to: r.user.id,
            optional: false,
        }),
        targetUser: r.one.user({
            from: r.followUsers.targetUserId,
            to: r.user.id,
            optional: false,
        }),
    },
    setupDrafts: {
        user: r.one.user({
            from: r.setupDrafts.userId,
            to: r.user.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.setupDrafts.setupId,
            to: r.setups.id,
        }),
    },
    bookmarks: {
        user: r.one.user({
            from: r.bookmarks.userId,
            to: r.user.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.bookmarks.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    notifications: {
        user: r.one.user({
            from: r.notifications.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    itemReports: {
        reporter: r.one.user({
            from: r.itemReports.reporterId,
            to: r.user.id,
            optional: false,
        }),
        item: r.one.items({
            from: r.itemReports.itemId,
            to: r.items.id,
            optional: false,
        }),
    },
    setupReports: {
        reporter: r.one.user({
            from: r.setupReports.reporterId,
            to: r.user.id,
            optional: false,
        }),
        setup: r.one.setups({
            from: r.setupReports.setupId,
            to: r.setups.id,
            optional: false,
        }),
    },
    userReports: {
        reporter: r.one.user({
            from: r.userReports.reporterId,
            to: r.user.id,
            optional: false,
        }),
        reportee: r.one.user({
            from: r.userReports.reporteeId,
            to: r.user.id,
            optional: false,
        }),
    },
    auditLogs: {
        user: r.one.user({
            from: r.auditLogs.userId,
            to: r.user.id,
            optional: false,
        }),
    },
}))
