import { resolveEffectiveCategory } from '@avatio/core/catalog'

describe('resolveEffectiveCategory', () => {
    it.each([
        [{}, 'other'],
        [{ primarySourceCategory: 'shader' as const }, 'shader'],
        [{ catalogOverride: 'tool' as const, primarySourceCategory: 'shader' as const }, 'tool'],
        [
            {
                setupOverride: 'accessory' as const,
                catalogOverride: 'tool' as const,
                primarySourceCategory: 'shader' as const,
            },
            'accessory',
        ],
    ])('resolves %o as %s', (input, expected) => {
        expect(resolveEffectiveCategory(input)).toBe(expected)
    })
})
