export const normalizeSetupPoint = (
    clientX: number,
    clientY: number,
    bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
) => ({
    x: bounds.width > 0 ? Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)) : 0.5,
    y: bounds.height > 0 ? Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)) : 0.5,
})

export const copySetupPoints = (points: readonly SetupPoint[]): SetupPoint[] =>
    points.map(({ id, imageId, entryId, x, y }) => ({ id, imageId, entryId, x, y }))

export const setupPointStyle = ({ x, y }: Pick<SetupPoint, 'x' | 'y'>) => ({
    left: `${x * 100}%`,
    top: `${y * 100}%`,
})

export const setupExpandedPointPosition = (index: number, total: number) => ({
    x: index % 2 ? 1 : 0,
    y: (Math.floor(index / 2) + 1) / (Math.ceil(total / 2) + 1),
})
