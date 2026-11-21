import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import Coauthors from '~/components/setups/compose/coauthors.vue'
import Item from '~/components/setups/compose/item.vue'
import Items from '~/components/setups/compose/items.vue'
import type { SetupComposeEntry } from '~/composables/setupComposeEntries'

const mocks = vi.hoisted(() => ({ compose: {} as Record<string, unknown> }))
mockNuxtImport('useSetupCompose', () => () => mocks.compose)
registerEndpoint('/api/items/suggested', () => [])

const entry = (id: string, category: ItemCategory = 'avatar'): SetupComposeEntry => ({
    id,
    itemId: id,
    name: id,
    category,
    note: '',
    shapekeys: [],
    unsupported: false,
    image: null,
    primarySource: null,
})
const menuAction = async (label: string) => {
    await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    const action = [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
        item.textContent?.includes(label),
    )!
    await new DOMWrapper(action).trigger('click')
    await nextTick()
}
const stubs = { CommandPaletteItemSearch: { template: '<input aria-label="Search items" />' } }

describe('Compose keyboard controls', () => {
    beforeEach(() => clearNuxtData())
    afterEach(() => vi.restoreAllMocks())

    it('reorders only the selected category, keeps focus on the moved item, and focuses a neighbour after removal', async () => {
        const entries = ref([entry('Alpha'), entry('Beta'), entry('Other', 'other')])
        const reorderCategory = vi.fn((category: ItemCategory, next: SetupComposeEntry[]) => {
            entries.value = [...next, ...entries.value.filter((item) => item.category !== category)]
        })
        mocks.compose = {
            entries,
            totalItemsCount: computed(() => entries.value.length),
            reorderCategory,
            itemSearchTerm: ref(''),
            itemScrollTop: ref(0),
            values: ref({ images: [] }),
            removeItem: (_category: ItemCategory, id: string) => {
                entries.value = entries.value.filter((item) => item.id !== id)
            },
        }
        const wrapper = await mountSuspended(Items, { attachTo: document.body, global: { stubs } })
        const trigger = wrapper.get('[data-entry-id="Alpha"] [data-reorder]')
        await trigger.trigger('keydown', { key: 'Enter' })
        await menuAction('reorder.down')
        expect(entries.value.map(({ id }) => id)).toEqual(['Beta', 'Alpha', 'Other'])
        await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element))
        expect(wrapper.get('[role="status"]').text()).toBe('reorder.position')
        await wrapper.get('[data-entry-id="Alpha"] [data-remove]').trigger('click')
        await vi.waitFor(() =>
            expect(document.activeElement).toBe(
                wrapper.get('[data-entry-id="Other"] [data-remove]').element,
            ),
        )
        wrapper.unmount()
    })

    it('reorders coauthors and returns focus to the add button when the last row is removed', async () => {
        const coauthors = ref(
            ['Ada', 'Bo'].map((name) => ({
                userId: name,
                username: name,
                note: '',
                user: { name, image: null },
            })),
        )
        mocks.compose = {
            coauthors,
            setCoauthors: (next: typeof coauthors.value) => {
                coauthors.value = next
            },
            removeCoauthor: (id: string) => {
                coauthors.value = coauthors.value.filter(({ userId }) => userId !== id)
            },
        }
        const wrapper = await mountSuspended(Coauthors, { attachTo: document.body })
        const trigger = wrapper.get('[data-coauthor-id="Bo"] [data-reorder]')
        await trigger.trigger('keydown', { key: 'Enter' })
        await menuAction('reorder.up')
        expect(coauthors.value.map(({ userId }) => userId)).toEqual(['Bo', 'Ada'])
        await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element))
        expect(wrapper.get('input').attributes('aria-label')).toBe('dynamicFields.noteFor')
        await wrapper.get('[data-coauthor-id="Bo"] [data-remove]').trigger('click')
        await wrapper.get('[data-coauthor-id="Ada"] [data-remove]').trigger('click')
        await vi.waitFor(() =>
            expect(document.activeElement).toBe(wrapper.get('[data-add-coauthor]').element),
        )
        wrapper.unmount()
    })

    it('labels shapekey fields, focuses invalid input, and keeps a useful focus after add/remove', async () => {
        const shapekeys = ref<SetupEntryShapekey[]>([])
        const wrapper = await mountSuspended(Item, {
            props: { item: entry('Avatar'), index: 0, count: 1, shapekeys: shapekeys.value },
            attrs: {
                'onShapekey-add': (key: SetupEntryShapekey) => {
                    shapekeys.value.push({ name: key.name, value: key.value })
                },
                'onShapekey-remove': ({ index }: { index: number }) => {
                    shapekeys.value.splice(index, 1)
                },
            },
            attachTo: document.body,
        })
        const popover = wrapper
            .findAll('button')
            .find((button) => button.text().includes('setup.compose.items.shapekeys'))!
        await popover.trigger('click')
        await vi.waitFor(() =>
            expect(
                document.querySelector('input[aria-label="dynamicFields.shapekeyName"]'),
            ).not.toBeNull(),
        )
        const name = document.querySelector<HTMLInputElement>(
            'input[aria-label="dynamicFields.shapekeyName"]',
        )!
        const add = document.querySelector<HTMLButtonElement>(
            'button[aria-label="dynamicFields.addShapekey"]',
        )!
        add.click()
        await vi.waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
        expect(document.activeElement).toBe(name)
        expect(
            document.getElementById(name.getAttribute('aria-describedby')!)?.getAttribute('role'),
        ).toBe('alert')
        expect(wrapper.emitted('shapekey-add')).toBeUndefined()
        await new DOMWrapper(name).setValue('Smile')
        await new DOMWrapper(name).trigger('keydown', { key: 'Enter' })
        expect(wrapper.emitted('shapekey-add')?.at(-1)).toEqual([
            { category: 'avatar', id: 'Avatar', name: 'Smile', value: 0 },
        ])
        expect(shapekeys.value).toEqual([{ name: 'Smile', value: 0 }])
        expect(document.activeElement).toBe(name)
        document.querySelector<HTMLButtonElement>('[data-shapekey-remove]')!.click()
        expect(shapekeys.value).toEqual([])
        await vi.waitFor(() => expect(document.activeElement).toBe(name))
        wrapper.unmount()
    })
})
