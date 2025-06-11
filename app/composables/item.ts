export const useFetchBooth = async (id: number): Promise<Item | null> => {
    if (!id) return null

    try {
        const response = await $fetch('/api/item/booth', {
            query: { id: encodeURIComponent(id) },
        })

        if (!response) return null
        return response
    } catch (e) {
        // エラーをコンソールに出力
        console.error('Boothアイテム取得エラー:', e)
        return null
    }
}
