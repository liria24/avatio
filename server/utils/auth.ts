import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth/minimal'
import type { BetterAuthOptions } from 'better-auth/minimal'
import { customSession } from 'better-auth/plugins'
import type { H3Event } from 'h3'
import { nanoid } from 'nanoid'
import { useEvent, useStorage } from 'nitropack/runtime'
import { withHttps } from 'ufo'

const JPG_FILENAME_LENGTH = 16
const authLog = logger('better-auth')

const logBetterAuthError = (message: string, args: unknown[]) => {
    const error = args.find((arg): arg is Error => arg instanceof Error)
    const detail = error?.message
    const summary = message || 'Better Auth request failed'

    authLog.error(detail ? `${summary}: ${detail}` : summary)
}

type CacheInvalidationEvent = H3Event & {
    context: H3Event['context'] & {
        userDeletionCacheTags?: string[]
    }
}

const getCurrentEvent = () => {
    try {
        return useEvent() as CacheInvalidationEvent
    } catch {
        return null
    }
}

export const purgeUserSettingsSessionCache = async (userId: string) => {
    await useStorage('auth').del(getUserSettingsCacheKey(userId))
}

const productionCookies = process.env.NODE_ENV === 'production'

const createAuth = (event?: H3Event) => {
    const options = {
        ...authSchemaOptions,
        appName: 'Avatio',
        // Cloudflare replaces process.env with an empty object in Workers.
        // Resolve secrets from the typed WebsiteEnv binding at request time.
        secret: getRuntimeEnvString('BETTER_AUTH_SECRET', event) ?? '',

        baseURL: {
            allowedHosts: [
                'localhost',
                'localhost:*',
                'dev.avatio.me',
                'avatio.me',
                '*.workers.dev',
            ],
        },

        database: drizzleAdapter(dbProxy, {
            provider: 'sqlite',
            schema,
            usePlural: true,
        }),

        user: {
            ...authSchemaOptions.user,
            deleteUser: {
                enabled: true,
            },
        },

        session: {
            expiresIn: 60 * 60 * 24 * 30,
            updateAge: 60 * 60 * 24,
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
                clientId: getRuntimeEnvString('TWITTER_CLIENT_ID', event) ?? '',
                clientSecret: getRuntimeEnvString('TWITTER_CLIENT_SECRET', event) ?? '',
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
                                await storage.upload(
                                    `avatar/${imageId}.jpg`,
                                    Buffer.from(arrayBuffer),
                                    {
                                        contentType: 'image/jpeg',
                                    },
                                )
                                image = withHttps(await storage.url(`avatar/${imageId}.jpg`))
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
                update: {
                    after: async (user) => {
                        const event = getCurrentEvent()
                        if (!event) return

                        await purgeUserContentCache(
                            event,
                            useDB(),
                            user.id,
                            'better auth user update',
                            { includePopularAvatars: true },
                        )
                    },
                },
                delete: {
                    before: async (user) => {
                        const event = getCurrentEvent()
                        if (!event) return

                        event.context.userDeletionCacheTags = await getUserContentCacheTags(
                            useDB(),
                            user.id,
                        )
                    },
                    after: async (_user) => {
                        const event = getCurrentEvent()
                        if (!event) return

                        await purgeEdgeCacheTags(
                            event,
                            [
                                ...(event.context.userDeletionCacheTags || []),
                                EDGE_CACHE_TAGS.popularAvatars,
                            ],
                            'better auth user delete',
                        )
                    },
                },
            },
        },

        onAPIError: {
            // Let Better Auth turn API errors into its expected response instead of
            // rethrowing them past Nitro, where the original cause was discarded.
            onError: (error) => logBetterAuthError('API error', [error]),
        },

        logger: {
            level: 'error',
            disableColors: true,
            log: (_level, message, ...args) => logBetterAuthError(message, args),
        },

        advanced: {
            ...authSchemaOptions.advanced,
            ipAddress: {
                ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
            },
            useSecureCookies: productionCookies,
        },
    } satisfies BetterAuthOptions

    return betterAuth({
        ...options,
        plugins: [
            ...options.plugins,
            customSession(async ({ user, session }) => {
                const settings = await getUserSettingsForSession(
                    useStorage('auth'),
                    user.id,
                    SESSION_COOKIE_CACHE_MAX_AGE,
                    async () =>
                        (await dbProxy.query.userSettings.findFirst({
                            where: { userId: { eq: user.id } },
                            columns: {
                                updatedAt: true,
                                showPrivateSetups: true,
                                showNSFW: true,
                            },
                        })) ?? undefined,
                )

                return {
                    user: { ...user, settings },
                    session,
                }
            }, options),
        ],
    })
}

export type Auth = ReturnType<typeof createAuth>

let authInstance: Auth | undefined
let authConfigKey: string | undefined

/** Resolve Better Auth only after Cloudflare has installed the request env. */
export const getAuth = (event?: H3Event): Auth => {
    const secret = getRuntimeEnvString('BETTER_AUTH_SECRET', event) ?? ''
    const clientId = getRuntimeEnvString('TWITTER_CLIENT_ID', event) ?? ''
    const clientSecret = getRuntimeEnvString('TWITTER_CLIENT_SECRET', event) ?? ''
    const configKey = `${secret}\u0000${clientId}\u0000${clientSecret}`

    if (!authInstance || authConfigKey !== configKey) {
        authInstance = createAuth(event)
        authConfigKey = configKey
    }

    return authInstance
}

export type Session = Auth['$Infer']['Session']
export type Sessions = Awaited<ReturnType<Auth['api']['listDeviceSessions']>>
