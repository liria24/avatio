import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, customSession, multiSession, username } from 'better-auth/plugins'
import { nanoid } from 'nanoid'

import { db, schema } from '../../server/utils/database'

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

    baseURL: process.env.NUXT_BETTER_AUTH_URL as string,
    secret: process.env.NUXT_BETTER_AUTH_SECRET as string,

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
        expiresIn: 60 * 60 * 24 * 30, // 30日間
        updateAge: 60 * 60 * 24, // 1日ごとに更新
        freshAge: 60 * 15, // 15分間はフレッシュとみなす
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5分間のキャッシュ
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
            { plugins }
        ),
    ],

    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        customRules: {
            '/sign-in/social': {
                window: 60,
                max: 10,
            },
            '/get-session': {
                window: 60,
                max: 200,
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
                value: { key: string; count: number; lastRequest: number }
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
                            const fetched = await $fetch<Blob>(image)
                            const imageId = nanoid(JPG_FILENAME_LENGTH)
                            await s3.write(
                                `avatar/${imageId}.jpg`,
                                Buffer.from(await fetched.arrayBuffer())
                            )
                            image = `${process.env.NUXT_PUBLIC_R2_DOMAIN}/avatar/${imageId}.jpg`
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
        useSecureCookies: process.env.NUXT_ENV_VERCEL_ENV === 'production',
        // CSRF保護を有効化
        disableCSRFCheck: false,
        defaultCookieAttributes: {
            httpOnly: true,
            secure: process.env.NUXT_ENV_VERCEL_ENV === 'production',
            sameSite: 'lax',
        },
    },
})

export type Session = typeof auth.$Infer.Session
export type Sessions = Awaited<ReturnType<typeof auth.api.listDeviceSessions>>
