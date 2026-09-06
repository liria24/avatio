import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/d1'
import { describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'
import { createTestD1 } from '../../helpers/d1'

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
                    { field: 'providerId', value: 'twitter' },
                    { field: 'accountId', value: 'twitter-user' },
                ],
            }),
        ).resolves.toBeNull()
        expect(select).toHaveBeenCalledOnce()
    })

    it('registers and signs in against the migrated D1 schema without an issuer', async () => {
        const database = createTestD1()
        const auth = betterAuth({
            ...authSchemaOptions,
            baseURL: 'https://avatio.test',
            secret: 'test-only-secret-for-auth-schema-regression',
            database: drizzleAdapter(drizzle(database.binding, { relations }), {
                provider: 'sqlite',
                schema,
                usePlural: true,
            }),
            emailAndPassword: { enabled: true },
        })
        try {
            const credentials = { email: 'auth@example.com', password: 'test-password-12345' }
            const registered = await auth.api.signUpEmail({
                body: { ...credentials, name: 'Auth User', username: 'auth_user' },
            })
            const signedIn = await auth.api.signInEmail({ body: credentials, returnHeaders: true })
            expect(signedIn.response.user.id).toBe(registered.user.id)
            const session = await auth.api.getSession({
                headers: new Headers({
                    cookie: signedIn.headers
                        .getSetCookie()
                        .map((cookie) => cookie.split(';')[0])
                        .join('; '),
                }),
            })
            expect(session?.user.id).toBe(registered.user.id)
            expect(
                database.sqlite.prepare('SELECT issuer, provider_id FROM accounts').get(),
            ).toMatchObject({ issuer: null, provider_id: 'credential' })
        } finally {
            database.sqlite.close()
        }
    })
})
