import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    extractColorsFromImageData: vi.fn(),
    pngRead: vi.fn(),
    warn: vi.fn(),
}))

vi.mock('extract-colors', () => ({
    extractColorsFromImageData: mocks.extractColorsFromImageData,
}))

vi.mock('pngjs/browser', () => ({
    PNG: {
        sync: {
            read: mocks.pngRead,
        },
    },
}))

const imageBuffer = Buffer.from([1, 2, 3])

const loadExtractImageColors = async () => {
    const module = await import('../../../server/utils/extractImageColors')
    return module.extractImageColors
}

describe('extractImageColors', () => {
    beforeEach(() => {
        mocks.extractColorsFromImageData.mockReset()
        mocks.pngRead.mockReset()
        mocks.warn.mockReset()

        vi.stubGlobal('logger', () => ({ warn: mocks.warn }))
    })

    afterEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('filters unsuitable pixels, sorts colors by area and limits the palette to six', async () => {
        mocks.pngRead.mockReturnValue({
            data: Buffer.from([240, 40, 40, 255, 40, 180, 80, 255]),
            width: 2,
            height: 1,
        })
        mocks.extractColorsFromImageData.mockReturnValue([
            ...[1, 7, 2, 6, 3, 5, 4].map((area) => ({ hex: `#00000${area}`, area })),
        ])

        const extractImageColors = await loadExtractImageColors()
        const result = await extractImageColors(imageBuffer)

        expect(mocks.pngRead).toHaveBeenCalledWith(imageBuffer)
        expect(mocks.extractColorsFromImageData).toHaveBeenCalledWith(
            {
                data: new Uint8ClampedArray([240, 40, 40, 255, 40, 180, 80, 255]),
                width: 2,
                height: 1,
            },
            expect.objectContaining({
                pixels: 2,
                saturationDistance: 0.5,
                lightnessDistance: 0.65,
                hueDistance: 0.3,
            }),
        )
        const { colorValidator } = mocks.extractColorsFromImageData.mock.calls[0]![1] as {
            colorValidator: (r: number, g: number, b: number, alpha: number) => boolean
        }
        expect(colorValidator(240, 40, 40, 255)).toBe(true)
        expect(colorValidator(240, 40, 40, 0)).toBe(false)
        expect(colorValidator(255, 255, 255, 255)).toBe(false)
        expect(colorValidator(0, 0, 0, 255)).toBe(false)
        expect(result).toEqual({
            colors: ['#000007', '#000006', '#000005', '#000004', '#000003', '#000002'],
            width: 2,
            height: 1,
        })
    })

    it('returns empty metadata and logs a warning when PNG decoding fails', async () => {
        const decodeError = new Error('Invalid PNG')
        mocks.pngRead.mockImplementation(() => {
            throw decodeError
        })

        const extractImageColors = await loadExtractImageColors()

        await expect(extractImageColors(imageBuffer)).resolves.toEqual({
            colors: [],
            width: 0,
            height: 0,
        })
        expect(mocks.warn).toHaveBeenCalledWith('Failed to extract image colors:', decodeError)
    })
})
