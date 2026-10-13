import { useManualRefHistory } from '@vueuse/core'
import { shallowRef, watch, type Ref } from 'vue'

import { copySetupPoints } from '../../shared/utils/setupPoints'

export const useSetupPointHistory = (
    points: Readonly<Ref<SetupPoint[]>>,
    update: (points: SetupPoint[]) => void,
) => {
    const snapshot = shallowRef(copySetupPoints(points.value))
    const history = useManualRefHistory(snapshot, { clone: copySetupPoints, capacity: 100 })
    watch(
        points,
        (next) => {
            if (JSON.stringify(next) === JSON.stringify(snapshot.value)) return
            snapshot.value = copySetupPoints(next)
            history.commit()
            history.clear()
        },
        { flush: 'sync' },
    )
    const commit = (next: SetupPoint[]) => {
        if (JSON.stringify(next) === JSON.stringify(snapshot.value)) return
        snapshot.value = copySetupPoints(next)
        history.commit()
        update(copySetupPoints(next))
    }
    const undo = () => {
        if (!history.canUndo.value) return
        history.undo()
        update(copySetupPoints(snapshot.value))
    }
    const redo = () => {
        if (!history.canRedo.value) return
        history.redo()
        update(copySetupPoints(snapshot.value))
    }
    return { commit, undo, redo, canUndo: history.canUndo, canRedo: history.canRedo }
}
