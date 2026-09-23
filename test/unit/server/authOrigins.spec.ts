import {
    isAvatioWorkerOrigin,
    parseConfiguredAuthOrigins,
    resolveAuthTrustedOrigins,
} from '../../../server/utils/authOrigins'

describe('Better Auth trusted origins', () => {
    it('accepts only configured URL origins from the runtime binding', () => {
        expect(
            parseConfiguredAuthOrigins(JSON.stringify(['https://avatio.me/path', 'not-a-url', 24])),
        ).toEqual(['https://avatio.me'])
    })

    it('recognizes Avatio preview origins without trusting arbitrary workers.dev hosts', () => {
        expect(isAvatioWorkerOrigin('https://a1b2c3-avatio.account.workers.dev')).toBe(true)
        expect(isAvatioWorkerOrigin('https://branch-avatio-development.account.workers.dev')).toBe(
            true,
        )
        expect(isAvatioWorkerOrigin('https://unrelated.account.workers.dev')).toBe(false)
        expect(isAvatioWorkerOrigin('https://avatio.attacker.workers.dev.example.com')).toBe(false)
    })

    it('adds only the exact Avatio preview origin serving the request', () => {
        const preview = 'https://v123-avatio.account.workers.dev'
        expect(
            resolveAuthTrustedOrigins({
                configuredOrigins: ['https://avatio.me'],
                request: new Request(`${preview}/api/auth/get-session`),
            }),
        ).toEqual(['https://avatio.me', preview])
        expect(
            resolveAuthTrustedOrigins({
                configuredOrigins: ['https://avatio.me'],
                request: new Request('https://unrelated.account.workers.dev/api/auth/get-session'),
            }),
        ).toEqual(['https://avatio.me'])
    })
})
