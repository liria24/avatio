import type { NotificationPayload } from '~~/database/schema'

export const useNotificationAttributes = (type: NotificationType, payload: NotificationPayload) => {
    const { t, locale } = useI18n()

    type Labels = Record<
        NotificationType,
        {
            title: string
            message?: string
            actionLabel?: string
        }
    >
    type Hrefs = Partial<Record<NotificationType, { href: string }>>

    const labels: Labels = {
        system_announcement: {
            title: payload.content || '',
        },
        user_badge_granted: {
            title: t('notifications.types.user_badge_granted.title'),
            message: payload.content,
        },
        setup_coauthor_added: {
            title: t('notifications.types.setup_coauthor_added.title'),
            message: payload.setup?.name,
        },
        user_role_changed: {
            title: t('notifications.types.user_role_changed.title', { role: payload.content }),
        },
        user_banned: {
            title: t('notifications.types.user_banned.title'),
        },
        user_unbanned: {
            title: t('notifications.types.user_unbanned.title'),
        },
        user_followed: {
            title: t('notifications.types.user_followed.title', { name: payload.user?.name }),
        },
        setup_created: {
            title: t('notifications.types.setup_created.title', { name: payload.user?.name }),
            message: payload.setup?.name,
        },
    }

    const href: Hrefs = {
        setup_coauthor_added: {
            href: `/setup/${payload.setup?.id}`,
        },
        user_followed: {
            href: `/@${payload.user?.username}`,
        },
        setup_created: {
            href: `/setup/${payload.setup?.id}`,
        },
    }

    return {
        labels: payload.customTranslations?.[locale.value] || labels[type],
        href: href[type]?.href,
    }
}
