import { verifyPublisherVerificationChallenge } from '@avatio/core/publishers'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })
const bodySchema = z.object({ url: z.url() })

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const [{ id }, { url }] = await Promise.all([
            validateParams(paramsSchema),
            validateBody(bodySchema, { sanitize: true }),
        ])
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `publisher-verification:${session.user.id}`,
        })

        try {
            const ownership = await verifyPublisherVerificationChallenge({
                id,
                userId: session.user.id,
                url: new URL(url),
                repository: getPublisherRepository(),
                providers: getPublisherVerificationProviderRegistry(),
            })
            await invalidateUserContentCache(event, db, session.user.id, 'publisher verified')
            return ownership
        } catch (error) {
            throwPublisherVerificationHttpError(error)
        }
    },
    { rejectBannedUser: true },
)
