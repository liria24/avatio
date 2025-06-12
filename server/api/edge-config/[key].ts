import { get } from '@vercel/edge-config'
import { z } from 'zod/v4'

const params = z.object({
    key: z.string('Key must be a string').min(1, 'Key cannot be empty'),
})

export default defineEventHandler(async () => {
    const { key } = await validateParams(params)

    const value = await get(key)

    return value
})
