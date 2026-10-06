import { describe, expect, it } from 'vitest'
import { effectScope, isProxy, ref } from 'vue'

import { useSetupPointHistory } from '../../../app/composables/setupPointHistory'

describe('point edit history', () => {
    it('copies Vue points, groups completed edits, supports redo, and resets for externally replaced data', () => {
        const scope = effectScope()
        const points = ref<SetupPoint[]>([
            { id: 'one', imageId: 'image', entryId: 'entry', x: 0.2, y: 0.3 },
        ])
        const history = scope.run(() =>
            useSetupPointHistory(points, (next) => {
                points.value = next
            }),
        )!
        history.commit([...points.value, { ...points.value[0]!, id: 'two' }])
        history.commit(
            points.value.map((point) => (point.id === 'one' ? { ...point, x: 0.8 } : point)),
        )
        expect(points.value).toHaveLength(2)
        history.undo()
        expect(points.value[0]!.x).toBe(0.2)
        history.undo()
        expect(points.value).toHaveLength(1)
        history.redo()
        expect(points.value).toHaveLength(2)
        expect(isProxy(points.value)).toBe(true)
        history.commit(points.value.filter(({ id }) => id !== 'one'))
        expect(history.canRedo.value).toBe(false)
        points.value = [{ id: 'external', imageId: 'other', entryId: 'entry', x: 0, y: 1 }]
        expect(history.canUndo.value).toBe(false)
        scope.stop()
    })
})
