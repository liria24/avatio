import type { CacheInvalidationInput } from '@avatio/core'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { defineServerAuth, type ServerAuthContext } from '@nuxtjs/better-auth/config'
import type { BetterAuthOptions } from 'better-auth'
import type { H3Event } from 'h3'
import { nanoid } from 'nanoid'
import { useEvent } from 'nitropack/runtime'

import { SESSION_COOKIE_CACHE_MAX_AGE } from '../shared/utils/constants'
import { logger } from '../shared/utils/logger'
import { parseConfiguredAuthOrigins, resolveAuthTrustedOrigins } from './utils/authOrigins'
import { authSchemaOptions } from './utils/authSchemaOptions'
import { dbProxy, schema } from './utils/database'
import { getRuntimeEnvString } from './utils/runtimeEnv'

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
        userDeletionCacheResources?: CacheInvalidationInput
    }
}

const getCurrentEvent = () => {
    try {
        return useEvent() as CacheInvalidationEvent
    } catch {
        return null
    }
}

export const createAvatioAuthOptions = ({ runtimeConfig }: ServerAuthContext) => {
    const configuredOrigins = parseConfiguredAuthOrigins(
        getRuntimeEnvString('AUTH_TRUSTED_ORIGINS'),
    )
    const publicConfig = runtimeConfig.public as { siteUrl?: unknown } | undefined
    if (typeof publicConfig?.siteUrl === 'string') configuredOrigins.push(publicConfig.siteUrl)

    const options = {
        ...authSchemaOptions,
        appName: 'Avatio',

        database: drizzleAdapter(dbProxy, {
            provider: 'sqlite',
            schema,
            usePlural: true,
        }),

        trustedOrigins: (request?: Request) =>
            resolveAuthTrustedOrigins({ configuredOrigins, request }),

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

        // The module initializes an anonymous session while prerendering static
        // pages. No Worker/D1 binding exists in that build-only renderer, and
        // its internal request does not need abuse protection. Runtime requests
        // retain the database-backed Better Auth rate limiter.
        rateLimit: {
            ...authSchemaOptions.rateLimit,
            enabled: !import.meta.prerender,
        },

        emailAndPassword: {
            enabled: import.meta.dev,
        },

        socialProviders: {
            twitter: {
                clientId: getRuntimeEnvString('TWITTER_CLIENT_ID') ?? '',
                clientSecret: getRuntimeEnvString('TWITTER_CLIENT_SECRET') ?? '',
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
                                const imageId = nanoid(JPG_FILENAME_LENGTH)
                                const { getFileStorage } = await import('./utils/infrastructure')
                                image = (
                                    await getFileStorage(
                                        getCurrentEvent() ?? undefined,
                                    ).importFromUrl({
                                        sourceUrl: image,
                                        destinationKey: `avatar/${imageId}.jpg`,
                                    })
                                ).url
                            } catch {
                                image = null
                            }

                        return {
                            data: {
                                ...user,
                                image,
                                lastAgreedToTerms: null,
                            },
                        }
                    },
                },
                update: {
                    after: async (user) => {
                        const event = getCurrentEvent()
                        if (!event) return

                        const { invalidateUserContentCache } = await import('./utils/edgeCache')
                        const { useDB } = await import('./utils/database')
                        await invalidateUserContentCache(
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

                        const { getUserContentCacheResources } = await import('./utils/edgeCache')
                        const { useDB } = await import('./utils/database')
                        event.context.userDeletionCacheResources =
                            await getUserContentCacheResources(useDB(), user.id)
                    },
                    after: async () => {
                        const event = getCurrentEvent()
                        if (!event) return

                        const { EDGE_CACHE_TAGS, invalidateCacheResources } =
                            await import('./utils/edgeCache')
                        const resources = event.context.userDeletionCacheResources ?? {}
                        await invalidateCacheResources(
                            event,
                            {
                                ...resources,
                                collections: [
                                    ...(resources.collections ?? []),
                                    EDGE_CACHE_TAGS.popularAvatars,
                                ],
                            },
                            'better auth user delete',
                        )
                    },
                },
            },
        },

        onAPIError: {
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
                ipAddressHeaders: import.meta.dev
                    ? ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']
                    : ['cf-connecting-ip'],
            },
            useSecureCookies: !import.meta.dev,
        },
    } satisfies BetterAuthOptions

    return options
}

export default defineServerAuth(createAvatioAuthOptions)
