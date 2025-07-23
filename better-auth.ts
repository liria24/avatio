import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, multiSession } from 'better-auth/plugins'
import database from './database'

export const auth = betterAuth({
    appName: 'Avatio',
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
    baseURL: import.meta.env.NUXT_BETTER_AUTH_URL as string,
    secret: import.meta.env.NUXT_BETTER_AUTH_SECRET as string,
    trustedOrigins: [
        'http://localhost:3000',
        'https://dev.avatio.me',
        'https://avatio.me',
    ],
    database: drizzleAdapter(database, {
        provider: 'pg',
    }),
    socialProviders: {
        twitter: {
            clientId: import.meta.env.TWITTER_CLIENT_ID as string,
            clientSecret: import.meta.env.TWITTER_CLIENT_SECRET as string,
        },
    },
    deleteUser: {
        enabled: true,
    },
    plugins: [admin(), multiSession()],
    cookieCache: {
        enabled: true,
        maxAge: 3 * 60,
    },
    rateLimit: {
        storage: 'database',
    },
    onAPIError: {
        throw: true,
    },
})

export type Session = typeof auth.$Infer.Session
