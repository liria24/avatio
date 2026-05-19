import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import UserBadges from '~/components/userBadges.vue'

mockNuxtImport('useBadges', () => () => ({
    badgeDefinitions: computed(() => ({
        developer: {
            icon: 'fluent-color:code-block-24',
            iconScale: 1.2,
            label: 'Developer',
        },
        contributor: {
            icon: 'fluent-color:animal-paw-print-24',
            iconScale: 1,
            label: 'Contributor',
        },
    })),
}))

describe('UserBadges', () => {
    const stubs = { UTooltip: { template: '<slot />' } }

    it('renders nothing when badges is empty', async () => {
        const wrapper = await mountSuspended(UserBadges, {
            props: { badges: [] },
        })
        expect(wrapper.find('div').exists()).toBe(false)
    })

    it('renders the icon for a matching badge', async () => {
        const wrapper = await mountSuspended(UserBadges, {
            props: { badges: [{ badge: 'developer' as const }] },
            global: { stubs },
        })
        expect(wrapper.html()).toContain('fluent-color:code-block-24')
    })

    it('does not render the icon for a non-matching badge', async () => {
        const wrapper = await mountSuspended(UserBadges, {
            props: { badges: [{ badge: 'contributor' as const }] },
            global: { stubs },
        })
        // developer badge should not be present
        expect(wrapper.html()).not.toContain('fluent-color:code-block-24')
    })
})
