export default async (id: string): Promise<Booth | null> => {
    const log = logger('fetchBoothItem')

    try {
        const response = await $fetch<Booth>(`/${id}.json`, {
            baseURL: 'https://booth.pm/ja/items',
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })

        return response
    } catch (error) {
        log.error(`Failed to fetch booth item ${id}:`, error)
        return null
    }
}
