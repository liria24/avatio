import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import ConfigPage from '~/pages/admin/config.vue'

mockNuxtImport('useAdmin', () => () => ({ saveAppConfig: vi.fn() }))

const item = (id: string) => ({
    id,
    name: id,
    image: null,
    category: 'avatar',
    manualCategoryOverride: 'avatar',
    primarySource: null,
})
let fail = false
const writes: string[] = []
registerEndpoint('/api/admin/config', () => ({
    isMaintenance: false,
    providerAdmissions: [
        {
            providerKey: 'booth',
            match: 'any',
            facets: [
                { key: 'shop-name', discovery: 'configured-only', options: [] },
                {
                    key: 'category',
                    discovery: 'observed',
                    options: [{ valueKey: 'avatar', label: 'Avatar', decision: 'allow' }],
                },
            ],
        },
    ],
}))
registerEndpoint('/api/admin/items', () => ({ data: [item('Alpha'), item('Beta')] }))
for (const id of ['Alpha', 'Beta']) {
    registerEndpoint(`/api/admin/items/${id}`, {
        method: 'PATCH',
        handler: () => {
            writes.push(id)
            if (fail) throw createError({ statusCode: 503, statusMessage: 'Test unavailable' })
            return item(id)
        },
    })
}
beforeEach(() => {
    clearNuxtData()
    fail = false
    writes.length = 0
})
afterEach(() => vi.restoreAllMocks())

it('labels repeated controls and focuses added, failed, and remaining override rows', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountSuspended(ConfigPage, {
        attachTo: document.body,
        global: {
            stubs: {
                CommandPaletteItemSearch: {
                    emits: ['select'],
                    setup: () => ({ candidate: item('Gamma') }),
                    template:
                        '<div><input aria-label="Search overrides" /><button type="button" @click="$emit(\'select\', candidate)">Add Gamma</button></div>',
                },
            },
        },
    })
    expect(wrapper.get('[data-override-id="Alpha"] legend').text()).toBe('Alpha')
    expect(
        wrapper.get('[data-override-id="Alpha"] [role="combobox"]').attributes('aria-label'),
    ).toBe('Category for Alpha')
    expect(wrapper.find('input[aria-label="BOOTH shop name"]').exists()).toBe(true)
    expect(wrapper.findAll('[aria-pressed="true"]').map((button) => button.text())).toContain(
        'Allow',
    )
    await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Add Gamma')!
        .trigger('click')
    await vi.waitFor(() =>
        expect(document.activeElement).toBe(
            wrapper.get('[data-override-id="Gamma"] [role="combobox"]').element,
        ),
    )
    expect(writes).toEqual([])
    fail = true
    await wrapper.get('button[aria-label="Save category override for Alpha"]').trigger('click')
    const control = wrapper.get('[data-override-id="Alpha"] [role="combobox"]')
    await vi.waitFor(() => expect(control.attributes('aria-invalid')).toBe('true'))
    await vi.waitFor(() => expect(document.activeElement).toBe(control.element))
    expect(
        document.getElementById(control.attributes('aria-describedby') ?? '')?.textContent,
    ).toContain('save failed')
    fail = false
    await wrapper.get('button[aria-label="Remove category override for Beta"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-override-id="Beta"]').exists()).toBe(false))
    await vi.waitFor(() =>
        expect(document.activeElement).toBe(
            wrapper.get('[data-override-id="Gamma"] [role="combobox"]').element,
        ),
    )
    wrapper.unmount()
})
