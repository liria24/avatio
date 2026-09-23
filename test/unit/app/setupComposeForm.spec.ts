import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useSetupComposeForm } from '../../../app/composables/setupComposeForm'

describe('setup compose form autosave subscription', () => {
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
})
