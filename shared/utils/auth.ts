import { put } from '@tigrisdata/storage'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, customSession, multiSession, username } from 'better-auth/plugins'
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

const plugins = [
    username({
        minUsernameLength: 3,
    }),
    admin(),
    multiSession(),
]

export const auth = betterAuth({
    appName: 'Avatio',

    baseURL: process.env.PUBLIC_SITE_URL as string,
    secret: process.env.BETTER_AUTH_SECRET as string,

    trustedOrigins: ['http://localhost:3000', 'https://dev.avatio.me', 'https://avatio.me'],

    database: drizzleAdapter(db, { provider: 'pg', schema }),

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
        expiresIn: SESSION_EXPIRES_IN,
        updateAge: SESSION_UPDATE_AGE,
        freshAge: SESSION_FRESH_AGE,
        cookieCache: {
            enabled: true,
            maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
        },
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

    plugins: [
        ...plugins,
        customSession(
            async ({ user, session }) => {
                return {
                    user,
                    session,
                }
            },
            { plugins },
        ),
    ],

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
        customStorage: {
            get: async (key: string) => {
                try {
                    const storage = useStorage('cache')
                    const result = await storage.getItem<{
                        key: string
                        count: number
                        lastRequest: number
                    }>(`rate-limit:${key}`)
                    return result || undefined
                } catch (error) {
                    console.error('Rate limit storage get error:', error)
                    return undefined
                }
            },
            set: async (
                key: string,
                value: { key: string; count: number; lastRequest: number },
            ) => {
                try {
                    const storage = useStorage('cache')
                    await storage.setItem(`rate-limit:${key}`, value)
                } catch (error) {
                    console.error('Rate limit storage set error:', error)
                }
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
