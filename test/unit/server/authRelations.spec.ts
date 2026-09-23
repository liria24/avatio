import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { describe, expect, it, vi } from 'vitest'

import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'

describe('Better Auth relations', () => {
    it('enables database joins with Better Auth 1.7.3', () => {
        expect(authSchemaOptions.advanced.database.joins).toBe(true)
    })

    it('falls back to separate session and user queries on RC.4', async () => {
        const rows = new Map<unknown, Record<string, string>[]>([
            [
                schema.sessions,
                [
                    {
                        id: 'session-id',
                        token: 'session-token',
                        userId: 'user-id',
                    },
                ],
            ],
            [
                schema.users,
                [
                    {
                        id: 'user-id',
                        name: 'User',
                        email: 'user@example.com',
                    },
                ],
            ],
        ])
        const select = vi.fn(() => ({
            from: (table: unknown) => ({
                where: async () => rows.get(table) ?? [],
            }),
        }))
        const adapter = drizzleAdapter({ select } as never, {
            provider: 'sqlite',
            schema,
            usePlural: true,
        })(authSchemaOptions)

        const session = await adapter.findOne({
            model: 'session',
            where: [{ field: 'token', value: 'session-token' }],
            join: { user: true },
        })

        expect(session).toMatchObject({ user: { id: 'user-id' } })
        expect(select).toHaveBeenCalledTimes(2)
    })
})
