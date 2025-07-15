import database from '@@/database'
import { feedbacks } from '@@/database/schema'

const body = feedbacksInsertSchema.pick({
    comment: true,
    contextPath: true,
})

const generateHash = async (): Promise<string> => {
    const event = useEvent()

    const today = new Date().toISOString().split('T')[0]
    const ip = getRequestIP(event)
    const userAgent = event.headers.get('user-agent') || 'unknown'

    const data = `${today}+${ip}+${userAgent}`

    const buffer = await crypto.subtle.digest(
        'SHA-1',
        new TextEncoder().encode(data)
    )

    return [...new Uint8Array(buffer)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

export default defineApi(
    async () => {
        const { comment, contextPath } = await validateBody(body, {
            sanitize: true,
        })

        await database.insert(feedbacks).values({
            fingerprint: await generateHash(),
            comment,
            contextPath,
        })

        return null
    },
    {
        errorMessage: 'Failed to post feedback.',
    }
)
