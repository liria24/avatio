export default (input: string): string | null => {
    try {
        const url = new URL(input)

        const hostname = url.hostname

        if (hostname.split('.').slice(-2).join('.') !== 'booth.pm') return null

        return hostname.split('.')[0] || null
    } catch {
        return null
    }
}
