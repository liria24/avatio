import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/neon-serverless'

import { relations } from './database/relations'
import * as schema from './database/schema'
import { authSchemaOptions } from './server/utils/authSchemaOptions'

const database = drizzle.mock({ relations })

export const auth = betterAuth({
    ...authSchemaOptions,
    database: drizzleAdapter(database, {
        provider: 'pg',
        schema,
        usePlural: true,
    }),
})
