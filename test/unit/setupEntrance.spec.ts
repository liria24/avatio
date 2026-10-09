import { describe, expect, it } from 'vitest'

import { useSetupEntrance } from '../../app/composables/setupEntrance'

describe('page-owned Setup entrance assignments', () => {
    it('commits only successful displays, separately per tab, and retires interrupted batches', () => {
        const entrance = useSetupEntrance()
        expect(entrance.display('owned', false, ['a']).size).toBe(0)
        expect(entrance.tabs.owned.visited).toBe(false)
        expect(entrance.display('owned', true, ['a']).get('a')?.delay).toBe(0)
        expect(entrance.display('latest', true, ['a']).has('a')).toBe(true)
        expect(entrance.display('owned', true, ['a']).size).toBe(0)
        entrance.display('bookmarked', true, [])
        expect(entrance.tabs.bookmarked.visited).toBe(true)
        expect(entrance.display('bookmarked', true, ['new-filter-result']).size).toBe(0)
        entrance.append('owned', ['background'])
        expect(entrance.display('owned', true, ['a', 'background']).size).toBe(0)
    })
    it('fixes index-order delays within each explicit batch and never reassigns consumed IDs', () => {
        const entrance = useSetupEntrance()
        const ids = Array.from({ length: 24 }, (_, index) => String(index))
        const pending = entrance.display('latest', true, ids)
        expect([...pending.values()].map((batch) => batch.delay)).toEqual(
            ids.map((_, rank) => rank * (180 / 23)),
        )
        pending.delete('0') // mounted/started, without waiting for animationend
        entrance.append('latest', ['0', '24', '25'])
        expect(pending.has('0')).toBe(false)
        expect(pending.get('23')?.delay).toBe(180)
        expect(pending.get('24')).toEqual({ delay: 0, appended: true })
        expect(pending.get('25')?.delay).toBe(32)
        entrance.display('latest', true, [...ids, 'filter'])
        expect(pending.has('filter')).toBe(false)
        expect(useSetupEntrance().display('latest', true, ['0']).has('0')).toBe(true)
    })
})
