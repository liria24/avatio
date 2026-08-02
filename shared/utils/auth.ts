import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth/minimal'
import type { BetterAuthOptions } from 'better-auth/minimal'
import { admin, multiSession, username, customSession } from 'better-auth/plugins'
import type { H3Event } from 'h3'
import { nanoid } from 'nanoid'
import { useEvent } from 'nitropack/runtime/internal/context'
import { useStorage } from 'nitropack/runtime/internal/storage'
import { withHttps } from 'ufo'

import { dbProxy, schema, useDB } from '../../server/utils/database'
import {
    EDGE_CACHE_TAGS,
    getUserContentCacheTags,
    purgeEdgeCacheTags,
    purgeUserContentCache,
} from '../../server/utils/edgeCache'
import { storage } from '../../server/utils/storage'
import {
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_SESSION,
    RATE_LIMIT_SIGNIN,
    RATE_LIMIT_WINDOW,
    SESSION_COOKIE_CACHE_MAX_AGE,
} from './constants'
import { getUserSettingsForSession } from './userSettingsCache'

const JPG_FILENAME_LENGTH = 16

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

const minUsernameLength = 3
const productionCookies =
    process.env.NODE_ENV === 'production' || process.env.CLOUDFLARE_ENV === 'production'

const options = {
    appName: 'Avatio',
    secret: process.env.BETTER_AUTH_SECRET as string,

    baseURL: {
        allowedHosts: ['localhost', 'localhost:*', 'dev.avatio.me', 'avatio.me', '*.workers.dev'],
    },

    database: drizzleAdapter(dbProxy, {
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
            lastAgreedToTerms: {
                type: 'date',
                required: false,
            },
        },
        deleteUser: {
            enabled: true,
        },
    },

    account: {
        storeStateStrategy: 'database',
    },

    verification: {
        storeInDatabase: true,
    },

    session: {
        storeSessionInDatabase: true,
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
        },
    },

    emailAndPassword: {
        enabled: import.meta.dev ?? false,
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
        storage: 'database',
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
        throw: true,
    },

    advanced: {
        ipAddress: {
            ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
            disableIpTracking: false,
        },
        useSecureCookies: productionCookies,
        disableCSRFCheck: false,
        defaultCookieAttributes: {
            httpOnly: true,
            secure: productionCookies,
            sameSite: 'lax',
        },
    },
} satisfies BetterAuthOptions

export const auth = betterAuth({
    ...options,
    plugins: [
        ...(options.plugins ?? []),
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

export type Session = typeof auth.$Infer.Session
export type Sessions = Awaited<ReturnType<typeof auth.api.listDeviceSessions>>
