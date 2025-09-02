import { consola } from 'consola'

export default async (id: string): Promise<Booth | null> => {
    try {
        return await $fetch(`https://booth.pm/ja/items/${id}.json`, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        consola.error(`Failed to fetch booth item ${id}:`, error)
        return null
    }
}
