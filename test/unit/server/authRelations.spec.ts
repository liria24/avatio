import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { describe, expect, it, vi } from 'vitest'

import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'

describe('Better Auth relations', () => {
    it('falls back to separate session and user queries on RC.4', async () => {
        const rows = new Map([
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
            from: (table: typeof schema.sessions | typeof schema.users) => ({
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

        expect(session?.user).toMatchObject({ id: 'user-id' })
        expect(select).toHaveBeenCalledTimes(2)
    })
})
