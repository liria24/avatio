import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SetupComposePage from '~/pages/setup/compose.vue'

const mocks = vi.hoisted(() => ({
    requestFetch: vi.fn(),
    user: { value: { id: 'autosave-user' } },
}))

mockNuxtImport('useUserSession', () => () => ({ user: mocks.user }))
mockNuxtImport('useRequestFetch', () => () => mocks.requestFetch)
mockNuxtImport('useMediaQuery', () => () => ({ value: true }))

registerEndpoint('/api/setup-drafts', { method: 'GET', handler: () => [] })

describe('Setup compose autosave UI', () => {
    afterEach(() => {
        vi.useRealTimers()
        mocks.requestFetch.mockReset()
    })

    it('saves the latest field value and never presents an older in-flight save as current', async () => {
        const first = Promise.withResolvers<{ revision: number }>()
        const second = Promise.withResolvers<{ revision: number }>()
        mocks.requestFetch
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise)
        const wrapper = await mountSuspended(SetupComposePage, {
            global: {
                stubs: {
                    SetupsComposeDraftsModal: { template: '<div><slot /></div>' },
                    SetupsComposeImages: true,
                    SetupsComposeTags: true,
                    SetupsComposeCoauthors: true,
                    SetupsComposeItems: true,
                    USplitter: {
                        template: '<div><slot name="left" /><slot name="right" /></div>',
                    },
                },
            },
        })
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

        const title = wrapper.get('input[name="name"]')
        await title.setValue('A')
        expect(wrapper.get('[data-testid="draft-status"]').text()).toContain(
            'setup.compose.draftStatus.unsaved',
        )

        await vi.advanceTimersByTimeAsync(2000)
        expect(wrapper.get('[data-testid="draft-status"]').text()).toContain(
            'setup.compose.draftStatus.saving',
        )
        expect(mocks.requestFetch).toHaveBeenCalledTimes(1)

        await title.setValue('B')
        first.resolve({ revision: 1 })
        await vi.waitFor(() =>
            expect(wrapper.get('[data-testid="draft-status"]').text()).toContain(
                'setup.compose.draftStatus.unsaved',
            ),
        )

        await vi.advanceTimersByTimeAsync(2000)
        expect(mocks.requestFetch).toHaveBeenCalledTimes(2)
        expect(wrapper.get('[data-testid="draft-status"]').text()).toContain(
            'setup.compose.draftStatus.saving',
        )
        expect(mocks.requestFetch).toHaveBeenLastCalledWith(
            expect.stringMatching(/^\/api\/setup-drafts\//),
            expect.objectContaining({
                method: 'PUT',
                body: expect.objectContaining({
                    expectedRevision: 1,
                    content: expect.objectContaining({ name: 'B' }),
                }),
            }),
        )

        second.resolve({ revision: 2 })
        await vi.waitFor(() =>
            expect(wrapper.get('[data-testid="draft-status"]').text()).toContain(
                'setup.compose.draftStatus.saved',
            ),
        )
        wrapper.unmount()
    })
})
