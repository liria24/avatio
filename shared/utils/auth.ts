import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, customSession, multiSession } from 'better-auth/plugins'
import { nanoid } from 'nanoid'
import { db } from '~~/server/utils/database'

const JPG_FILENAME_LENGTH = 16
const USER_ID_LENGTH = 10

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
        deleteUser: {
            enabled: true,
        },
    },

    baseURL: process.env.NUXT_BETTER_AUTH_URL as string,
    secret: process.env.NUXT_BETTER_AUTH_SECRET as string,

    trustedOrigins: [
        'http://localhost:3000',
        'https://dev.avatio.me',
        'https://avatio.me',
    ],

    // レート制限の設定（Nuxt server storage使用）
    rateLimit: {
        enabled: true,
        window: 60, // 60秒のウィンドウ
        max: 100, // 最大100リクエスト
        customRules: {
            // Twitter認証エンドポイントに厳しい制限
            '/sign-in/social': {
                window: 60,
                max: 10,
            },
            // セッション取得は緩い制限
            '/get-session': {
                window: 60,
                max: 200,
            },
        },
        // Nuxt server storageのcacheを使用（既にUpstash KVが設定済み）
        customStorage: {
            get: async (key: string) => {
                try {
                    const storage = useStorage('cache')
                    // better-authのRateLimit型に合わせて取得
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
                    // storageはTTLを内部で管理するため、単純にsetItemを使用
                    await storage.setItem(`rate-limit:${key}`, value)
                } catch (error) {
                    console.error('Rate limit storage set error:', error)
                }
            },
        },
    },

    database: drizzleAdapter(db, { provider: 'pg' }),

    socialProviders: {
        twitter: {
            clientId: process.env.TWITTER_CLIENT_ID as string,
            clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
            mapProfileToUser: async (profile) => {
                return {
                    email: profile.data.email,
                    name: profile.data.name,
                    bio: profile.data.description,
                    image: profile.data.profile_image_url?.endsWith(
                        '_normal.jpg'
                    )
                        ? profile.data.profile_image_url.replace(
                              /_normal\.jpg$/,
                              '_400x400.jpg'
                          )
                        : profile.data.profile_image_url,
                    emailVerified: true,
                }
            },
        },
    },

    plugins: [
        admin(),
        multiSession(),
        customSession(
            async ({ user, session }) => {
                const data = await db.query.user.findFirst({
                    where: {
                        id: { eq: user.id },
                    },
                    columns: {
                        isInitialized: true,
                    },
                })
                return {
                    user: {
                        ...user,
                        isInitialized: data?.isInitialized ?? false,
                    },
                    session,
                }
            },
            {
                plugins: [admin(), multiSession()],
            }
        ),
    ],

    // セッション設定の改善
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30日間
        updateAge: 60 * 60 * 24, // 1日ごとに更新
        freshAge: 60 * 15, // 15分間はフレッシュとみなす
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5分間のキャッシュ
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
                            await useStorage('r2').setItemRaw(
                                `avatar:${imageId}.jpg`,
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
            ipAddressHeaders: [
                'x-forwarded-for',
                'x-real-ip',
                'cf-connecting-ip',
            ],
            disableIpTracking: false,
        },
        // セキュアクッキーの強制（本番環境）
        useSecureCookies: process.env.NUXT_ENV_VERCEL_ENV === 'production',
        // CSRF保護を有効化
        disableCSRFCheck: false,
        // デフォルトクッキー属性の設定
        defaultCookieAttributes: {
            httpOnly: true,
            secure: process.env.NUXT_ENV_VERCEL_ENV === 'production',
            sameSite: 'lax',
        },
        database: {
            generateId: () => nanoid(USER_ID_LENGTH),
        },
    },
})

export type Session = typeof auth.$Infer.Session
