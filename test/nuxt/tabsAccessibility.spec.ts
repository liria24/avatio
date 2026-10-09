import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import HomePage from '~/pages/index.vue'
import ComposePage from '~/pages/setup/compose.vue'

const mocks = vi.hoisted(() => ({
    user: { value: { id: 'tab-user', username: 'tab-user' } },
    compose: {} as Record<string, unknown>,
}))
mockNuxtImport('useViewerContext', () => () => ({
    user: mocks.user,
    loggedIn: ref(true),
    preferences: ref({ showPrivateSetups: false }),
}))
mockNuxtImport('useUserSession', () => () => ({ user: mocks.user }))
mockNuxtImport('useUserSettingsUpdate', () => () => ({ update: vi.fn() }))
mockNuxtImport('useSetupCompose', () => () => mocks.compose)
mockNuxtImport('useMediaQuery', () => () => ref(false))

const requests: URLSearchParams[] = []
registerEndpoint('/api/setups', (event) => {
    const url = new URL(event.node.req.url ?? '/', 'http://localhost')
    requests.push(url.searchParams)
    return { data: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false } }
})
beforeEach(() => {
    clearNuxtData()
    requests.length = 0
})

it('loads home tabs only on activation, preserves route selection, and provides associated panels', async () => {
    const wrapper = await mountSuspended(HomePage, {
        route: '/',
        attachTo: document.body,
        global: { stubs: { SetupsList: true } },
    })
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[1]!.trigger('focus')
    await nextTick()
    expect(requests).toHaveLength(1)
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    await tabs[1]!.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() => expect(requests.at(-1)?.get('username')).toBe('tab-user'))
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query.tab).toBe('owned'))
    const panel = wrapper.get('[role="tabpanel"][data-state="active"]')
    expect(panel.attributes('aria-labelledby')).toBe(tabs[1]!.attributes('id'))
    expect(tabs[1]!.attributes('aria-controls')).toBe(panel.attributes('id'))
    await navigateTo('/?tab=bookmarked')
    await vi.waitFor(() => expect(requests.at(-1)?.get('bookmarked')).toBe('true'))
    await navigateTo('/')
    await vi.waitFor(() => expect(tabs[0]!.attributes('aria-selected')).toBe('true'))
    expect(requests).toHaveLength(3)
    wrapper.unmount()
})

it('keeps both mobile editing panels mounted while keyboard activation changes the visible panel', async () => {
    mocks.compose = {
        values: ref({}),
        editingSetupId: ref(null),
        draft: ref({ status: 'new' }),
        changed: ref(false),
        initialize: vi.fn(),
    }
    const wrapper = await mountSuspended(ComposePage, {
        route: '/',
        attachTo: document.body,
        global: {
            stubs: {
                SetupsComposeDraftsModal: { template: '<div><slot /></div>' },
                SetupsComposeDetails: {
                    setup: () => ({ value: ref('') }),
                    template: '<input v-model="value" data-testid="details-input" />',
                },
                SetupsComposeItems: {
                    setup: () => ({ value: ref('') }),
                    template: '<input v-model="value" data-testid="items-input" />',
                },
            },
        },
    })
    const tabs = wrapper.findAll('[role="tab"]')
    const detailsInput = wrapper.get('[data-testid="details-input"]')
    await detailsInput.setValue('Unsaved title')
    await tabs[1]!.trigger('focus')
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    await tabs[1]!.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(
        wrapper.get('[role="tabpanel"][data-state="inactive"]').attributes('hidden'),
    ).toBeDefined()
    await wrapper.get('[data-testid="items-input"]').setValue('Unsubmitted search')
    await tabs[0]!.trigger('keydown', { key: ' ' })
    await nextTick()
    expect(wrapper.get('[data-testid="details-input"]').element).toBe(detailsInput.element)
    expect((detailsInput.element as HTMLInputElement).value).toBe('Unsaved title')
    expect((wrapper.get('[data-testid="items-input"]').element as HTMLInputElement).value).toBe(
        'Unsubmitted search',
    )
    wrapper.unmount()
})
