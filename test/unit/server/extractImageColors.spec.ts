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

    it('extracts colors from the PNG sample', async () => {
        mocks.pngRead.mockReturnValue({
            data: Buffer.from([240, 40, 40, 255, 40, 180, 80, 255]),
            width: 2,
            height: 1,
        })
        mocks.extractColorsFromImageData.mockReturnValue([
            { hex: '#f02828', area: 0.75 },
            { hex: '#28b450', area: 0.25 },
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
        expect(result).toEqual({
            colors: ['#f02828', '#28b450'],
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
