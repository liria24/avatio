import { consola } from 'consola'

const fetchBoothItem = async (id: string): Promise<Booth | null> => {
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

export default async (id: string, platform: Platform) => {
    if (platform === 'booth') return await fetchBoothItem(id)

    return null
}
