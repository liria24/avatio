import { put } from '@tigrisdata/storage'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, multiSession, username } from 'better-auth/plugins'
import { nanoid } from 'nanoid'

import { db, schema } from '../../server/utils/database'
import {
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_SESSION,
    RATE_LIMIT_SIGNIN,
    RATE_LIMIT_WINDOW,
    SESSION_COOKIE_CACHE_MAX_AGE,
    SESSION_EXPIRES_IN,
    SESSION_FRESH_AGE,
    SESSION_UPDATE_AGE,
} from './constants'

const JPG_FILENAME_LENGTH = 16
const minUsernameLength = 3

export const auth = betterAuth({
    appName: 'Avatio',
    secret: process.env.BETTER_AUTH_SECRET as string,

    baseURL: process.env.PUBLIC_SITE_URL as string,
    trustedOrigins: ['http://localhost:3000', 'https://dev.avatio.me', 'https://avatio.me'],

    database: drizzleAdapter(db, {
        provider: 'pg',
        schema,
        usePlural: true,
    }),

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
        },
        deleteUser: {
            enabled: true,
        },
    },

    session: {
        storeSessionInDatabase: true,
        expiresIn: SESSION_EXPIRES_IN,
        updateAge: SESSION_UPDATE_AGE,
        freshAge: SESSION_FRESH_AGE,
        cookieCache: {
            enabled: true,
            maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
        },
    },

    emailAndPassword: {
        enabled: import.meta.dev,
    },

    socialProviders: {
        twitter: {
            clientId: process.env.TWITTER_CLIENT_ID as string,
            clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
            mapProfileToUser: async (profile) => ({
                username: profile.data.username,
                displayUsername: profile.data.username,
                email: profile.data.email,
                name: profile.data.name,
                bio: profile.data.description,
                image: profile.data.profile_image_url?.endsWith('_normal.jpg')
                    ? profile.data.profile_image_url.replace(/_normal\.jpg$/, '_400x400.jpg')
                    : profile.data.profile_image_url,
                emailVerified: true,
            }),
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
    },

    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    let image = user.image

                    if (image)
                        try {
                            const buffer = await $fetch<Blob>(image)
                            const arrayBuffer = await buffer.arrayBuffer()
                            const imageId = nanoid(JPG_FILENAME_LENGTH)
                            await put(`avatar/${imageId}.jpg`, Buffer.from(arrayBuffer), {
                                contentType: 'image/jpeg',
                                contentDisposition: 'inline',
                            })
                            image = `https://${process.env.TIGRIS_STORAGE_DOMAIN}/avatar/${imageId}.jpg`
                        } catch {
                            image = null
                        }

                    return {
                        data: {
                            ...user,
                            image,
                        },
                    }
                },
            },
        },
    },

    onAPIError: {
        throw: true,
    },

    advanced: {
        // IPアドレストラッキングの設定（プロキシ環境対応）
        ipAddress: {
            ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
            disableIpTracking: false,
        },
        // セキュアクッキーの強制（本番環境）
        useSecureCookies: process.env.ENV_VERCEL_ENV === 'production',
        // CSRF保護を有効化
        disableCSRFCheck: false,
        defaultCookieAttributes: {
            httpOnly: true,
            secure: process.env.ENV_VERCEL_ENV === 'production',
            sameSite: 'lax',
        },
    },
})

export type Session = typeof auth.$Infer.Session
export type Sessions = Awaited<ReturnType<typeof auth.api.listDeviceSessions>>
