import { betterAuth } from 'better-auth/minimal'

import { getStageConfig } from '../../../config/environment'
import { createAvatioAuthOptions } from '../../../server/auth.config'
import { createTestD1 } from '../../helpers/d1'

vi.mock('@nuxtjs/better-auth/config', () => ({ defineServerAuth: (value: unknown) => value }))
afterEach(() => vi.unstubAllGlobals())

const url = 'https://dev.avatio.me'
const authOptions = () =>
    createAvatioAuthOptions({
        runtimeConfig: { public: { siteUrl: url, emailPasswordAuthEnabled: true } },
    } as Parameters<typeof createAvatioAuthOptions>[0])

it('keeps Twitter OAuth and only the typed development origin', () => {
    vi.stubGlobal('__env__', {
        STAGE: 'development',
        TWITTER_CLIENT_SECRET: 'synthetic-client-secret',
    })
    const options = authOptions()
    expect(options.emailAndPassword.enabled).toBe(false)
    expect(options.socialProviders).toMatchObject({
        twitter: {
            clientId: getStageConfig('development').twitterClientId,
            clientSecret: 'synthetic-client-secret',
        },
    })
    expect(options.trustedOrigins).toEqual([url])
})

it.each(['production', 'development'])(
    'rejects email registration in %s despite the public UI flag',
    async (stage) => {
        const database = createTestD1()
        vi.stubGlobal('__env__', { APP_DB: database.binding, STAGE: stage })
        const options = authOptions()
        const auth = betterAuth({
            ...options,
            baseURL: url,
            secret: 'development-test-secret-with-more-than-32-characters',
        })
        try {
            expect(options.emailAndPassword.enabled).toBe(false)
            await expect(
                auth.api.signUpEmail({
                    body: {
                        email: 'user@example.test',
                        password: 'test-password-12345',
                        name: 'User',
                        username: 'blocked_user',
                    },
                }),
            ).rejects.toThrow()
            expect(
                database.sqlite.prepare('SELECT count(*) AS count FROM users').get(),
            ).toMatchObject({ count: 0 })
        } finally {
            database.sqlite.close()
        }
    },
)
