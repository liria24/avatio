import { createDefaultSetupComposeForm, isEmptySetupComposeForm } from '@avatio/core/setups'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'

import { useSetupComposeForm } from '../../../app/composables/setupComposeForm'

describe('setup compose form autosave subscription', () => {
    it('recognizes the reset form as empty', () => {
        expect(isEmptySetupComposeForm(createDefaultSetupComposeForm())).toBe(true)
        expect(isEmptySetupComposeForm({ ...createDefaultSetupComposeForm(), name: 'draft' })).toBe(
            false,
        )
    })
    it('snapshots a real TanStack Form field change without cloning Vue proxies', async () => {
        const onChange = vi.fn()
        const scope = effectScope()
        const compose = scope.run(() => useSetupComposeForm(onChange))!

        compose.form.setFieldValue('name', 'saved from UI')
        await nextTick()

        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ name: 'saved from UI' }),
        )
        expect(onChange.mock.lastCall?.[0]).not.toBe(compose.values.value)
        scope.stop()
    })

    it('keeps autosaved nested item values independent from reactive UI entries', async () => {
        const onChange = vi.fn()
        const scope = effectScope()
        const compose = scope.run(() => useSetupComposeForm(onChange))!
        const item = reactive({
            id: 'entry',
            itemId: 'catalog-item',
            category: 'other' as const,
            note: '',
            unsupported: false,
            shapekeys: [{ name: 'Smile', value: 0.5 }],
        })
        try {
            compose.form.setFieldValue('items', [item])
            await nextTick()
            expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ items: [item] }))
            const saved = onChange.mock.lastCall?.[0]
            item.shapekeys[0]!.value = 0.8
            expect(saved.items[0].shapekeys[0].value).toBe(0.5)
        } finally {
            scope.stop()
        }
    })

    it('does not schedule another save when restoring identical draft values', async () => {
        const onChange = vi.fn()
        const scope = effectScope()
        const compose = scope.run(() => useSetupComposeForm(onChange))!
        const restored = { ...createDefaultSetupComposeForm(), name: 'Restored draft' }
        try {
            compose.form.reset(restored)
            await nextTick()
            expect(onChange).toHaveBeenCalledOnce()
            onChange.mockClear()

            compose.form.reset({ ...createDefaultSetupComposeForm(), name: 'Restored draft' })
            await nextTick()
            expect(onChange).not.toHaveBeenCalled()

            compose.form.setFieldValue('name', 'Edited draft')
            await nextTick()
            expect(onChange).toHaveBeenCalledOnce()
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Edited draft' }))
        } finally {
            scope.stop()
        }
    })
})
