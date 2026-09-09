import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createIPX, type IPXStorage } from 'ipx'
import { PNG } from 'pngjs/browser'
import { beforeAll, describe, expect, it } from 'vitest'

import { processLocalUploadImage } from '../../../server/utils/imageProcessing.local'

describe('local IPX upload processing', () => {
    let source: Buffer

    beforeAll(async () => {
        source = await readFile(join(process.cwd(), 'public', 'pwa-192x192.png'))
    })

    const convert = async (format: 'jpeg' | 'png' | 'webp') => {
        const storage: IPXStorage = {
            name: 'fixture',
            getMeta: () => ({}),
            getData: () => source,
        }
        const result = await createIPX({ storage })('fixture', { format }).process()
        if (typeof result.data === 'string') throw new Error('Expected raster bytes.')
        return result.data
    }

    it.each([
        ['jpeg', 'image/jpeg'],
        ['png', 'image/png'],
        ['webp', 'image/webp'],
    ] as const)(
        'reads %s metadata and creates a bounded PNG sample',
        async (format, contentType) => {
            const processed = await processLocalUploadImage(await convert(format))
            const sample = PNG.sync.read(Buffer.from(processed.sample))
            expect(processed).toMatchObject({ contentType, width: 192, height: 192 })
            expect(sample.width).toBe(96)
            expect(sample.height).toBe(96)
        },
    )

    it('rejects corrupt image bytes', async () => {
        await expect(
            processLocalUploadImage(new TextEncoder().encode('not an image').buffer),
        ).rejects.toThrow()
    })
})
