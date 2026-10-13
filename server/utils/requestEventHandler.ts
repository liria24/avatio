import { createError, defineEventHandler, type RequestEvent } from 'nuxt/server'

/** Public HTTP handlers use the portable Nuxt event; auth/infrastructure retain Nitro boundaries. */
export const requestEventHandler = <T = unknown>(
    handler: ({
        event,
        db,
    }: {
        event: RequestEvent
        db: ReturnType<typeof useDB>
    }) => Promise<T> | T,
) =>
    defineEventHandler(async (event) => {
        const db = useDB()
        try {
            return await handler({ event, db })
        } catch (error) {
            if (isDatabaseUniqueConflict(error))
                throw createError({
                    status: 409,
                    statusText: 'Conflict',
                    message: 'The requested database state conflicts with an existing resource.',
                    cause: error,
                })
            throw error
        }
    })
