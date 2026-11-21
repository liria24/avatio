export const useBookmarks = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { user } = useUserSession()

    const toggle = async (setupId: Setup['id'], isBookmarked: boolean) => {
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
        const { data, status, refresh } = await useFetch<{ bookmarked: boolean }>(
            `/api/setups/bookmarks/${setupId}`,
            {
                key: computed(() => `bookmark-${user.value?.id || 'anonymous'}-${setupId}`),
                dedupe: 'defer',
                default: () => ({ bookmarked: false }),
                immediate,
            },
        )

        return {
            isBookmarked: computed(() => data.value.bookmarked),
            status,
            refresh,
        }
    }

    return {
        toggle,
        getBookmarkStatus,
    }
}
