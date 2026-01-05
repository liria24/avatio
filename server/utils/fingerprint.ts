export const getFingerprint = async () => {
    const event = useEvent()
    const headers = getHeaders(event)

    const ip = getRequestIP(event)
    const userAgent = headers['user-agent'] || 'unknown'

    const data = `${ip}+${userAgent}`

    const buffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data))

    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
