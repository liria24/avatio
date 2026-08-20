import { and, eq, lt } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getHeader, setResponseHeader } from 'h3'
import { z } from 'zod'

import { idempotencyRequests } from '../../database/schema'

const IDEMPOTENCY_LEASE_MS = 5 * 60 * 1000
const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const idempotencyKeySchema = z.uuid()

type JsonObject = { [key: string]: JsonValue }
type JsonValue = boolean | number | string | null | JsonObject | JsonValue[]

const normalizeForHash = (value: unknown): JsonValue => {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
    if (typeof value === 'string') return value
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(normalizeForHash)
    if (typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, normalizeForHash(child)]),
        )

    return JSON.stringify(value) ?? typeof value
}

const hashRequestBody = async (body: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(normalizeForHash(body)))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const conflict = (event: H3Event, message: string, retryAfter?: number): never => {
    if (retryAfter !== undefined) setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message })
}

export interface IdempotencyClaim {
    id: string
    key: string
    resourceId: string | null
    replay: boolean
    response: unknown
    statusCode: number | null
}

interface ClaimOptions {
    event: H3Event
    db: ReturnType<typeof useDB>
    scope: string
    route: string
    body: unknown
    resourceId?: string
}

export const claimIdempotencyRequest = async (options: ClaimOptions): Promise<IdempotencyClaim> => {
    const { event, db, scope, route, body, resourceId } = options
    const parsedKey = idempotencyKeySchema.safeParse(getHeader(event, 'Idempotency-Key'))
    if (!parsedKey.success)
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'A valid UUID Idempotency-Key header is required.',
        })

    const key = parsedKey.data
    const requestHash = await hashRequestBody(body)
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + IDEMPOTENCY_LEASE_MS)
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS)
    const findExisting = () =>
        db.query.idempotencyRequests.findFirst({
            where: {
                scope: { eq: scope },
                route: { eq: route },
                key: { eq: key },
            },
        })

    const resolveExisting = async (
        existing: NonNullable<Awaited<ReturnType<typeof findExisting>>>,
    ): Promise<IdempotencyClaim> => {
        if (existing.requestHash !== requestHash)
            conflict(event, 'The Idempotency-Key was already used with a different request body.')

        if (existing.status === 'completed')
            return {
                id: existing.id,
                key,
                resourceId: existing.resourceId,
                replay: true,
                response: existing.response,
                statusCode: existing.statusCode,
            }

        if (existing.leaseExpiresAt.getTime() > now.getTime()) {
            const retryAfter = Math.max(
                1,
                Math.ceil((existing.leaseExpiresAt.getTime() - now.getTime()) / 1000),
            )
            conflict(event, 'An identical request is still being processed.', retryAfter)
        }

        const [reclaimed] = await db
            .update(idempotencyRequests)
            .set({
                updatedAt: now,
                leaseExpiresAt,
                expiresAt,
                resourceId: existing.resourceId ?? resourceId,
            })
            .where(
                and(
                    eq(idempotencyRequests.id, existing.id),
                    eq(idempotencyRequests.status, 'pending'),
                    lt(idempotencyRequests.leaseExpiresAt, now),
                ),
            )
            .returning({ id: idempotencyRequests.id })

        if (!reclaimed) {
            const raced = await findExisting()
            if (!raced)
                throw new Error('Idempotency request disappeared while reclaiming its lease')
            return await resolveExisting(raced)
        }

        return {
            id: existing.id,
            key,
            resourceId: existing.resourceId ?? resourceId ?? null,
            replay: false,
            response: null,
            statusCode: null,
        }
    }

    const existing = await findExisting()
    if (existing) return await resolveExisting(existing)

    const id = crypto.randomUUID()
    const [created] = await db
        .insert(idempotencyRequests)
        .values({
            id,
            scope,
            route,
            key,
            requestHash,
            resourceId,
            leaseExpiresAt,
            expiresAt,
        })
        .onConflictDoNothing({
            target: [idempotencyRequests.scope, idempotencyRequests.route, idempotencyRequests.key],
        })
        .returning({ id: idempotencyRequests.id })

    if (!created) {
        const raced = await findExisting()
        if (!raced) throw new Error('Failed to claim idempotency request')
        return await resolveExisting(raced)
    }

    return {
        id,
        key,
        resourceId: resourceId ?? null,
        replay: false,
        response: null,
        statusCode: null,
    }
}

export const completeIdempotencyRequest = (
    db: ReturnType<typeof useDB>,
    claim: IdempotencyClaim,
    response: unknown,
    statusCode = 200,
) =>
    db
        .update(idempotencyRequests)
        .set({
            updatedAt: new Date(),
            status: 'completed',
            resourceId: claim.resourceId,
            response,
            statusCode,
            leaseExpiresAt: new Date(0),
        })
        .where(and(eq(idempotencyRequests.id, claim.id), eq(idempotencyRequests.status, 'pending')))
