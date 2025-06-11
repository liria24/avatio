export default (source: 'booth', id: number): ItemCategory | null => {
    if (source === 'booth') {
        const categoryMap: Record<number, ItemCategory> = {
            3087170: 'shader', // lilToon
            4841309: 'shader', // Poiyomi
        }
        if (categoryMap[id]) return categoryMap[id]
        return null
    }
    return null
}
