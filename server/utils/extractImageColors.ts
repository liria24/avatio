const log = logger('extractImageColors')
const MAX_SAMPLE_DIMENSION = 128

interface PngImage {
    width: number
    height: number
    data: Uint8Array
}

const createCloudflareImageUrl = (url: string) => {
    const baseUrl = useRuntimeConfig().public.siteUrl
    return `${baseUrl}/cdn-cgi/image/fit=scale-down,width=${MAX_SAMPLE_DIMENSION},format=png,quality=100/${url}`
}

const readUint32 = (view: DataView, offset: number) => view.getUint32(offset, false)

const concatBytes = (chunks: Uint8Array[]) => {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const result = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
    }
    return result
}

const inflate = async (bytes: Uint8Array) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
}

const decodePng = async (bytes: Uint8Array): Promise<PngImage | null> => {
    if (
        bytes.length < 24 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47
    )
        return null

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let offset = 8
    let width = 0
    let height = 0
    let colorType = 0
    let bitDepth = 0
    const idat: Uint8Array[] = []

    while (offset + 12 <= bytes.length) {
        const length = readUint32(view, offset)
        const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
        const dataStart = offset + 8
        const dataEnd = dataStart + length
        if (dataEnd + 4 > bytes.length) return null

        if (type === 'IHDR') {
            width = readUint32(view, dataStart)
            height = readUint32(view, dataStart + 4)
            bitDepth = bytes[dataStart + 8] ?? 0
            colorType = bytes[dataStart + 9] ?? 0
        } else if (type === 'IDAT') {
            idat.push(bytes.slice(dataStart, dataEnd))
        } else if (type === 'IEND') {
            break
        }

        offset = dataEnd + 4
    }

    if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) return null

    const channels = colorType === 6 ? 4 : 3
    const stride = width * channels
    const inflated = await inflate(concatBytes(idat))
    const rgba = new Uint8Array(width * height * 4)
    let sourceOffset = 0
    const previous = new Uint8Array(stride)
    const current = new Uint8Array(stride)

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset]
        sourceOffset += 1

        for (let x = 0; x < stride; x += 1) {
            const raw = inflated[sourceOffset + x] ?? 0
            const left = x >= channels ? current[x - channels]! : 0
            const up = previous[x] ?? 0
            const upperLeft = x >= channels ? previous[x - channels]! : 0
            let value = raw

            if (filter === 1) value = raw + left
            else if (filter === 2) value = raw + up
            else if (filter === 3) value = raw + Math.floor((left + up) / 2)
            else if (filter === 4) value = raw + paeth(left, up, upperLeft)
            else if (filter !== 0) return null

            current[x] = value & 0xff
        }

        for (let x = 0; x < width; x += 1) {
            const source = x * channels
            const target = (y * width + x) * 4
            rgba[target] = current[source]
            rgba[target + 1] = current[source + 1]
            rgba[target + 2] = current[source + 2]
            rgba[target + 3] = channels === 4 ? current[source + 3] : 255
        }

        previous.set(current)
        sourceOffset += stride
    }

    return { width, height, data: rgba }
}

const hex = (value: number) => value.toString(16).padStart(2, '0')

const quantizeColors = ({ data }: PngImage) => {
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 255
        if (alpha < 128) continue

        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0
        const saturation = Math.max(r, g, b) - Math.min(r, g, b)
        if (saturation < 18 && r > 235 && g > 235 && b > 235) continue
        if (r < 18 && g < 18 && b < 18) continue

        const key = `${r >> 4}-${g >> 4}-${b >> 4}`
        const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
        bucket.count += 1
        bucket.r += r
        bucket.g += g
        bucket.b += b
        buckets.set(key, bucket)
    }

    return [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((bucket) => {
            const r = Math.round(bucket.r / bucket.count)
            const g = Math.round(bucket.g / bucket.count)
            const b = Math.round(bucket.b / bucket.count)
            return `#${hex(r)}${hex(g)}${hex(b)}`
        })
}

interface ExtractedImageColors {
    colors: string[]
    width: number
    height: number
}

export const extractImageColors = async (imageUrl: string): Promise<ExtractedImageColors> => {
    try {
        const response = await fetch(createCloudflareImageUrl(imageUrl))
        if (!response.ok) return { colors: [], width: 0, height: 0 }

        const image = await decodePng(new Uint8Array(await response.arrayBuffer()))
        if (!image) return { colors: [], width: 0, height: 0 }

        return {
            colors: quantizeColors(image),
            width: image.width,
            height: image.height,
        }
    } catch (error) {
        log.warn('Failed to extract image colors:', error)
        return { colors: [], width: 0, height: 0 }
    }
}
