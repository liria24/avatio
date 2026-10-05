import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/d1'
import { describe, expect, it } from 'vitest'

import { relations } from '../../../database/relations'
import * as schema from '../../../database/schema'
import { authSchemaOptions } from '../../../server/utils/authSchemaOptions'
import { createTestD1 } from '../../helpers/d1'

describe('Better Auth account schema', () => {
    it('maps the OAuth account ID to the provider account column', async () => {
        const database = createTestD1()
        const db = drizzle(database.binding, { relations })
        const adapter = drizzleAdapter(db, { provider: 'sqlite', schema, usePlural: true })(
            authSchemaOptions,
        )
        try {
            database.sqlite.exec(`
                INSERT INTO users (id, name, username, display_username, email) VALUES ('owner', 'Owner', 'owner', 'Owner', 'owner@example.com');
                INSERT INTO accounts (id, provider_account_id, provider_id, user_id, created_at, updated_at) VALUES
                    ('twitter-account', 'shared-id', 'twitter', 'owner', 1, 2),
                    ('github-account', 'shared-id', 'github', 'owner', 1, 2),
                    ('other-account', 'other-id', 'twitter', 'owner', 1, 2);
            `)
            for (const providerId of ['twitter', 'github']) {
                expect(
                    await adapter.findOne({
                        model: 'account',
                        where: [
                            { field: 'providerId', value: providerId },
                            { field: 'accountId', value: 'shared-id' },
                        ],
                    }),
                ).toMatchObject({
                    id: providerId + '-account',
                    accountId: 'shared-id',
                    providerId,
                    userId: 'owner',
                })
            }
        } finally {
            database.sqlite.close()
        }
    })

    it('registers and signs in against the migrated D1 schema without an issuer', async () => {
        expect(authSchemaOptions.advanced.database.joins).toBe(true)
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
            expect(database.sqlite.prepare('SELECT provider_id FROM accounts').get()).toMatchObject(
                { provider_id: 'credential' },
            )
            expect(
                database.sqlite
                    .prepare('PRAGMA table_info(accounts)')
                    .all()
                    .map((row) => row.name),
            ).not.toContain('issuer')
        } finally {
            database.sqlite.close()
        }
    })
})
