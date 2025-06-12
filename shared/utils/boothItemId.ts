export default (input: string): number | null => {
    try {
        const url = new URL(input)

        const id = url.pathname.split('/').slice(-1)[0]

        if (!id || !Number.isInteger(Number(id))) return Number(id)

        return null
    } catch {
        return null
    }
}
