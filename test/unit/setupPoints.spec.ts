import { describe, expect, it } from 'vitest'

import { normalizeSetupPoint, setupExpandedPointPosition } from '../../shared/utils/setupPoints'

describe('setup image point coordinates', () => {
    it('normalizes against the rendered image and clamps outside input', () => {
        const bounds = { left: 100, top: 50, width: 400, height: 200 }
        expect(normalizeSetupPoint(300, 100, bounds)).toEqual({ x: 0.5, y: 0.25 })
        expect(normalizeSetupPoint(0, 500, bounds)).toEqual({ x: 0, y: 1 })
    })

    it('distributes expanded thumbnails down both image edges', () => {
        expect([0, 1, 2, 3].map((index) => setupExpandedPointPosition(index, 4))).toEqual([
            { x: 0, y: 1 / 3 },
            { x: 1, y: 1 / 3 },
            { x: 0, y: 2 / 3 },
            { x: 1, y: 2 / 3 },
        ])
    })
})
