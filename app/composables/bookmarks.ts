export const useBookmarks = () => {
    const { t } = useI18n()
    const toast = useToast()

    const toggle = async (setupId: number, isBookmarked: boolean) => {
        try {
            if (!isBookmarked) {
                await $fetch(`/api/setups/bookmarks/${setupId}`, {
                    method: 'POST',
                })
            } else {
                await $fetch(`/api/setups/bookmarks/${setupId}`, {
                    method: 'DELETE',
                })
            }

            toast.add({
                title: !isBookmarked ? t('toast.bookmarks.added') : t('toast.bookmarks.removed'),
                color: !isBookmarked ? 'success' : 'info',
            })

            return true
        } catch (error) {
            console.error('Error toggling bookmark:', error)
            toast.add({
                title: t('toast.bookmarks.toggleFailed'),
                color: 'error',
            })
            return false
        }
    }

    const getBookmarkStatus = async (setupId: number, immediate = true) => {
        const { data, status, refresh } = await useFetch('/api/setups/bookmarks', {
            query: { setupId, limit: 1 },
            transform: (data) => data.data.length > 0,
            dedupe: 'defer',
            default: () => false,
            immediate,
        })

        return {
            isBookmarked: data,
            status,
            refresh,
        }
    }

    return {
        toggle,
        getBookmarkStatus,
    }
}
