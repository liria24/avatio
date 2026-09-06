import { createPublisherVerificationChallenge } from '@avatio/core/publishers'
import { z } from 'zod'

const bodySchema = z.object({ url: z.url() })

export default authedSessionEventHandler(
    async ({ session }) => {
        const { url } = await validateBody(bodySchema, { sanitize: true })
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `publisher-verification-challenge:${session.user.id}`,
        })

        try {
            return await createPublisherVerificationChallenge({
                userId: session.user.id,
                url: new URL(url),
                repository: getPublisherRepository(),
                providers: getPublisherVerificationProviderRegistry(),
            })
        } catch (error) {
            throwPublisherVerificationHttpError(error)
        }
    },
    { rejectBannedUser: true },
)
