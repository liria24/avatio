import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { describe, expect, it, vi } from 'vitest'

import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'

describe('Better Auth account schema', () => {
    it('maps the OAuth account ID to the provider account column', async () => {
        const where = vi.fn().mockResolvedValue([])
        const from = vi.fn(() => ({ where }))
        const select = vi.fn(() => ({ from }))
        const adapter = drizzleAdapter({ select } as never, {
            provider: 'sqlite',
            schema,
            usePlural: true,
        })(authSchemaOptions)

        await expect(
            adapter.findOne({
                model: 'account',
                where: [
                    { field: 'issuer', value: 'https://api.twitter.com' },
                    { field: 'accountId', value: 'twitter-user' },
                ],
            }),
        ).resolves.toBeNull()
        expect(select).toHaveBeenCalledOnce()
    })
})
