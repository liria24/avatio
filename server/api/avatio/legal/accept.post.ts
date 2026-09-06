import { legalAcceptanceInputSchema } from '@avatio/core/legal'
import { z } from 'zod'

import { contentConfig } from '#avatio/content-config'

export default authedSessionEventHandler(
    async ({ db, event, session }) => {
        applyNoStoreCache(event)
        const { locale, documents } = await validateBody(
            z.object({
                locale: z.string().refine((value) => contentConfig.locales.includes(value)),
                documents: z
                    .array(legalAcceptanceInputSchema)
                    .min(1)
                    .max(2)
                    .refine(
                        (values) =>
                            new Set(values.map((value) => value.document)).size === values.length,
                    ),
            }),
            { sanitize: true },
        )
        const current = await getCurrentLegalDocuments(event, locale)
        return acceptLegalDocuments(db, session.user.id, current, documents)
    },
    { rejectBannedUser: true },
)
