import { z } from 'zod'

export const catalogSyncMessageSchema = z.object({
    version: z.literal(2),
    type: z.literal('catalog.sync-source'),
    sourceId: z.string().min(1),
})
