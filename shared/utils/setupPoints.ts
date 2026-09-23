export const normalizeSetupPoint = (
    clientX: number,
    clientY: number,
    bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
) => ({
    x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
})

export const setupPointStyle = ({ x, y }: Pick<SetupPoint, 'x' | 'y'>) => ({
    left: `${x * 100}%`,
    top: `${y * 100}%`,
})

export const setupExpandedPointPosition = (index: number, total: number) => ({
    x: index % 2 ? 1 : 0,
    y: (Math.floor(index / 2) + 1) / (Math.ceil(total / 2) + 1),
})
