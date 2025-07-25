import { get } from '@vercel/edge-config'
import { z } from 'zod'

const params = z.object({
    key: z.string('Key must be a string').min(1, 'Key cannot be empty'),
})

export default defineApi(
    async () => {
        const { key } = await validateParams(params)

        const value = await get(key)

        return value
    },
    {
        errorMessage: 'Failed to get item.',
    }
)
