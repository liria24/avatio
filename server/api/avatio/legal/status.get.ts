import { z } from 'zod'

import { contentConfig } from '#avatio/content-config'

export default authedSessionEventHandler(
    async ({ db, event, session }) => {
        applyNoStoreCache(event)
        const { locale } = await validateQuery(
            z.object({
                locale: z
                    .string()
                    .refine((value) => contentConfig.locales.includes(value))
                    .default(contentConfig.fallbackLocale),
            }),
        )
        return getLegalStatus(db, session.user.id, await getCurrentLegalDocuments(event, locale))
    },
    { rejectBannedUser: true },
)
