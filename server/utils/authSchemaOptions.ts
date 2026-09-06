import type { BetterAuthOptions } from 'better-auth/minimal'
import { admin, multiSession, username } from 'better-auth/plugins'

import { authAdditionalFields } from '../../shared/utils/authAdditionalFields'
import {
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_SESSION,
    RATE_LIMIT_SIGNIN,
    RATE_LIMIT_WINDOW,
} from '../../shared/utils/constants'

const minUsernameLength = 3

export const authSchemaOptions = {
    advanced: {
        database: {
            joins: true,
        },
    },

    account: {
        fields: {
            accountId: 'providerAccountId',
        },
    },

    user: {
        additionalFields: authAdditionalFields,
    },

    plugins: [username({ minUsernameLength }), admin(), multiSession()] as const,

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
