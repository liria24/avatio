import { z } from 'zod/v4'

const bodySchema = z.record(
    z.string().min(1, 'Value must be a non-empty string'),
    z.any()
)

const config = useRuntimeConfig()

export default defineApi(
    async () => {
        const body = await validateBody(bodySchema)

        const items = Object.entries(body).map(([key, value]) => ({
            operation: 'upsert',
            key,
            value,
        }))

        const result = await $fetch(config.vercel.edgeConfig.endpoint, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${config.vercel.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items }),
        })

        return result
    },
    {
        errorMessage: 'Failed to update edge config.',
        requireAdmin: true,
    }
)
