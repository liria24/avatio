import { destr } from 'destr'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import type { NotificationPayload } from '~~/database/schema'
import { notifications } from '~~/database/schema'
import type { NotificationType } from '~~/shared/types/database'
import { userSettingsDefaults } from '~~/shared/utils/userSettingsDefaults'

type Body = Omit<z.infer<typeof notificationsInsertSchema>, 'payload'> & {
    payload: NotificationPayload
    actorId?: string
}

type NotificationPreference = {
    site: 'notifSiteFollowed' | 'notifSiteFolloweePost' | 'notifSiteCoauthorAdded'
}

const notificationPreference: Partial<Record<NotificationType, NotificationPreference>> = {
    user_followed: {
        site: 'notifSiteFollowed',
    },
    setup_created: {
        site: 'notifSiteFolloweePost',
    },
    setup_coauthor_added: {
        site: 'notifSiteCoauthorAdded',
    },
}

export default async (
    _event: H3Event,
    db: ReturnType<typeof useDB>,
    body: Body,
): Promise<{ id: string } | null> => {
    const log = logger('createNotification')

    try {
        const { userId, type, payload, actionUrl, banner, dedupeKey } = body
        const [settingsData, actorData] = await Promise.all([
            db.query.userSettings.findFirst({
                where: { userId: { eq: userId } },
                columns: {
                    notifSiteEnabled: true,
                    notifSiteFollowed: true,
                    notifSiteFolloweePost: true,
                    notifSiteCoauthorAdded: true,
                },
            }),
            body.actorId
                ? Promise.resolve({ id: body.actorId })
                : payload.user?.username
                  ? db.query.users.findFirst({
                        where: { username: { eq: payload.user.username } },
                        columns: { id: true },
                    })
                  : Promise.resolve(null),
        ])
        const settings = {
            ...userSettingsDefaults,
            ...settingsData,
        }
        const preference = notificationPreference[type]
        const actorId = actorData?.id

        if (actorId) {
            const mute = await db.query.userMutes.findFirst({
                where: {
                    userId: { eq: userId },
                    muteeId: { eq: actorId },
                },
                columns: {
                    id: true,
                },
            })

            if (mute) return null
        }

        const shouldCreateSiteNotification =
            !preference || (settings.notifSiteEnabled && !!settings[preference.site])

        let result: { id: string } | null = null

        if (shouldCreateSiteNotification) {
            const [inserted] = await db
                .insert(notifications)
                .values({
                    userId,
                    type,
                    payload: destr(payload),
                    actionUrl,
                    banner,
                    dedupeKey,
                })
                .onConflictDoNothing()
                .returning({ id: notifications.id })

            result = inserted || null
        }

        return result
    } catch (error) {
        log.error('Failed to create notification:', error)
        return null
    }
}
