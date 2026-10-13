import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import { testUtils } from 'better-auth/plugins'

import * as schema from '../../database/schema'
import { authSchemaOptions } from '../../server/utils/authSchemaOptions'

/** Privileged fixtures live only in tests; application HTTP requests use the real auth config. */
export const createTestAuth = (
    database: Parameters<typeof drizzleAdapter>[0],
    secret: string,
    baseURL = 'http://localhost:3000',
) =>
    betterAuth({
        ...authSchemaOptions,
        baseURL,
        secret,
        database: drizzleAdapter(database, { provider: 'sqlite', schema, usePlural: true }),
        emailAndPassword: { enabled: true },
        advanced: { ...authSchemaOptions.advanced, useSecureCookies: false },
        plugins: [...authSchemaOptions.plugins, testUtils()],
    })
