import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'

describe('Better Auth relations', () => {
    it('falls back to separate session and user queries on RC.4', async () => {
        const db = drizzle.mock({ relations })
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
        db.select = select as typeof db.select
        const adapter = drizzleAdapter(db, {
            provider: 'pg',
            schema,
            schemaName: 'user',
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
