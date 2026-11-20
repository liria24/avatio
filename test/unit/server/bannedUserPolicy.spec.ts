import type { H3Event } from '@nuxt/nitro-server/h3'

describe('banned-user policy', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.resetModules()
    })

    it('rejects a banned admin independently from role authorization', async () => {
        const forbidden = new Error('forbidden')
        vi.stubGlobal('serverError', { forbidden: () => forbidden })
        const { assertSessionNotBanned } = await import('../../../server/utils/eventHandler')

        expect(() =>
            assertSessionNotBanned({
                user: { id: 'admin-1', role: 'admin', banned: true },
            } as never),
        ).toThrow(forbidden)
    })

    it('allows an active user', async () => {
        vi.stubGlobal('serverError', { forbidden: () => new Error('forbidden') })
        const { assertSessionNotBanned } = await import('../../../server/utils/eventHandler')

        expect(() =>
            assertSessionNotBanned({
                user: { id: 'user-1', role: 'user', banned: false },
            } as never),
        ).not.toThrow()
    })

    it('requires admin role and returns active session in requireAdminSession', async () => {
        const session = { user: { id: 'admin-1', role: 'admin', banned: false } }
        const requireUserSession = vi.fn().mockResolvedValue(session)
        vi.stubGlobal('requireUserSession', requireUserSession)
        vi.stubGlobal('serverError', { forbidden: () => new Error('forbidden') })
        const { assertSessionNotBanned } = await import('../../../server/utils/eventHandler')
        vi.stubGlobal('assertSessionNotBanned', assertSessionNotBanned)
        const { requireAdminSession } = await import('../../../server/utils/admin/session')

        const event = { path: '/api/admin/test' } as H3Event
        await expect(requireAdminSession(event)).resolves.toBe(session)
        expect(requireUserSession).toHaveBeenCalledWith(event, { user: { role: 'admin' } })
    })

    it('rejects a banned admin in requireAdminSession', async () => {
        const forbidden = new Error('forbidden')
        vi.stubGlobal(
            'requireUserSession',
            vi.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'admin', banned: true } }),
        )
        vi.stubGlobal('serverError', { forbidden: () => forbidden })
        const { assertSessionNotBanned } = await import('../../../server/utils/eventHandler')
        vi.stubGlobal('assertSessionNotBanned', assertSessionNotBanned)
        const { requireAdminSession } = await import('../../../server/utils/admin/session')

        await expect(requireAdminSession({} as H3Event)).rejects.toThrow(forbidden)
    })
})
