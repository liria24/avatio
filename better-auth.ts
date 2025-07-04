import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import database from './database'

export const auth = betterAuth({
    user: {
        additionalFields: {
            bio: {
                type: 'string',
                required: false,
            },
            links: {
                type: 'string[]',
                required: false,
            },
            isInitialized: {
                type: 'boolean',
                defaultValue: false,
                required: true,
            },
        },
    },
    baseURL: import.meta.env.NUXT_BETTER_AUTH_URL,
    secret: import.meta.env.NUXT_BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
        provider: 'pg',
    }),
    socialProviders: {
        twitter: {
            clientId: import.meta.env.TWITTER_CLIENT_ID,
            clientSecret: import.meta.env.TWITTER_CLIENT_SECRET,
        },
    },
    deleteUser: {
        enabled: true,
    },
    plugins: [admin()],
    cookieCache: {
        enabled: true,
        maxAge: 3 * 60,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // 1 day
    },
    rateLimit: {
        storage: 'database',
    },
})

export type Session = typeof auth.$Infer.Session
