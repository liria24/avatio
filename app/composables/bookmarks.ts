export const useBookmarks = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { session } = useAuth()

    const toggle = async (setupId: Setup['id'], isBookmarked: boolean) => {
        try {
            if (!isBookmarked) {
                await $fetch(`/api/setups/${setupId}/bookmark`, {
                    method: 'POST',
                })
            } else {
                await $fetch(`/api/setups/${setupId}/bookmark`, {
                    method: 'DELETE',
                })
            }

            toast.add({
                id: !isBookmarked ? `bookmark-added-${setupId}` : `bookmark-removed-${setupId}`,
                icon: 'mingcute:check-line',
                title: !isBookmarked ? t('toast.bookmarks.added') : t('toast.bookmarks.removed'),
                color: !isBookmarked ? 'success' : 'info',
            })

            return true
        } catch (error) {
            console.error('Error toggling bookmark:', error)
            toast.add({
                id: `bookmark-toggle-failed`,
                icon: 'mingcute:close-line',
                title: t('toast.bookmarks.toggleFailed'),
                color: 'error',
            })
            return false
        }
    }

    const getBookmarkStatus = async (setupId: Setup['id'], immediate = true) => {
        const { data, status, refresh } = await useFetch('/api/setups', {
            query: {
                setupId,
                bookmarkedBy: session.value?.user.username,
                limit: 1,
            },
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
