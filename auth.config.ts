import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/node-sqlite'

import { relations } from './database/relations'
import * as schema from './database/schema'
import { authSchemaOptions } from './server/utils/authSchemaOptions'

// Better Auth CLI schema-generation compatibility adapter only.
// Runtime auth is configured by server/auth.config.ts through @nuxtjs/better-auth.
const database = drizzle.mock({ relations })

export const auth = betterAuth({
    ...authSchemaOptions,
    database: drizzleAdapter(database, {
        provider: 'sqlite',
        schema,
        usePlural: true,
    }),
})
