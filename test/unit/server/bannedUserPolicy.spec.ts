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
})
