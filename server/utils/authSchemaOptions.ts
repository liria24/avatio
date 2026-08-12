import type { BetterAuthOptions } from 'better-auth/minimal'
import { admin, multiSession, username } from 'better-auth/plugins'

const minUsernameLength = 3

export const authSchemaOptions = {
    advanced: {
        database: {
            // ponytail: RC.4 crashes on plural one-to-one joins; re-enable after better-auth#10631 ships.
            joins: false,
        },
    },

    account: {
        fields: {
            accountId: 'providerAccountId',
        },
    },

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
            lastAgreedToTerms: {
                type: 'date',
                required: false,
            },
        },
    },

    plugins: [username({ minUsernameLength }), admin(), multiSession()],

    rateLimit: {
        enabled: true,
        window: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_DEFAULT,
        customRules: {
            '/sign-in/social': {
                window: RATE_LIMIT_WINDOW,
                max: RATE_LIMIT_SIGNIN,
            },
            '/get-session': {
                window: RATE_LIMIT_WINDOW,
                max: RATE_LIMIT_SESSION,
            },
        },
        storage: 'database',
    },
} satisfies BetterAuthOptions
