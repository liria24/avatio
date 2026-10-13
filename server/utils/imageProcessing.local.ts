import { Buffer } from 'node:buffer'

import { createIPX, type IPXStorage } from 'ipx'

const contentTypeByFormat = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
} as const

export const processLocalUploadImage = async (bytes: ArrayBuffer | Uint8Array) => {
    const data = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes)
    const storage: IPXStorage = {
        name: 'upload',
        getMeta: () => ({}),
        getData: () => data,
    }
    const result = await createIPX({
        storage,
        maxOutputDimension: 8192,
        sharpOptions: { limitInputPixels: 8192 * 8192 },
    })('upload', { width: 96, height: 96, fit: 'inside', format: 'png' }).process()
    const format = result.meta?.type

    return {
        contentType:
            format && format in contentTypeByFormat
                ? contentTypeByFormat[format as keyof typeof contentTypeByFormat]
                : (format ?? ''),
        width: result.meta?.width,
        height: result.meta?.height,
        sample:
            typeof result.data === 'string' ? new TextEncoder().encode(result.data) : result.data,
    }
}
