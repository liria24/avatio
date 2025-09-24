import database from '@@/database'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, customSession, multiSession } from 'better-auth/plugins'
import { nanoid } from 'nanoid'

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
            mapProfileToUser: async (profile) => {
                let image: string | null = null
                if (profile.data.profile_image_url)
                    try {
                        const fetched = await $fetch<Blob>(
                            profile.data.profile_image_url.endsWith(
                                '_normal.jpg'
                            )
                                ? profile.data.profile_image_url.replace(
                                      /_normal\.jpg$/,
                                      '_400x400.jpg'
                                  )
                                : profile.data.profile_image_url
                        )
                        const imageId = nanoid(JPG_FILENAME_LENGTH)
                        await useStorage('r2').setItemRaw(
                            `avatar:${imageId}.jpg`,
                            Buffer.from(await fetched.arrayBuffer())
                        )
                        image = `${import.meta.env.NUXT_PUBLIC_R2_DOMAIN}/avatar/${imageId}.jpg`
                    } catch {
                        image = null
                    }

                return {
                    email: profile.data.email,
                    name: profile.data.name,
                    image,
                    bio: profile.data.description,
                }
            },
        },
    },

    deleteUser: {
        enabled: true,
    },

    plugins: [
        admin(),
        multiSession(),
        customSession(
            async ({ user, session }) => {
                const data = await database.query.user.findFirst({
                    where: (users, { eq }) => eq(users.id, user.id),
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

    cookieCache: {
        enabled: true,
        maxAge: 3 * 60,
    },

    onAPIError: {
        throw: true,
    },

    advanced: {
        database: {
            generateId: () => nanoid(USER_ID_LENGTH),
        },
    },
})

export type Session = typeof auth.$Infer.Session
