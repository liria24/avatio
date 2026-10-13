import { getQuery, getRouterParams, type RequestEvent } from 'nuxt/server'
import type { z } from 'zod'

export const validateRequestQuery = <T extends z.ZodType>(event: RequestEvent, schema: T) =>
    throwIfValidationFailed('validateQuery', schema.safeParse(getQuery(event)))

export const validateRequestParams = <T extends z.ZodType>(event: RequestEvent, schema: T) =>
    throwIfValidationFailed('validateParams', schema.safeParse(getRouterParams(event)))
