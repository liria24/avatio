import type { UseFetchOptions } from 'nuxt/app'

export const useBookmarks = (
    options?: UseFetchOptions<PaginationResponse<SerializedBookmark[]>>
) => {
    const toast = useToast()

    const defaultOptions: UseFetchOptions<PaginationResponse<SerializedBookmark[]>> = {
        key: computed(() => `bookmarks-${JSON.stringify(unref(options?.query))}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    const {
        data: bookmarks,
        status,
        refresh,
    } = useFetch<PaginationResponse<SerializedBookmark[]>>('/api/setups/bookmarks', {
        ...defaultOptions,
        ...options,
    })

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
                title: !isBookmarked ? 'ブックマークしました' : 'ブックマークを解除しました',
                color: !isBookmarked ? 'success' : 'info',
            })

            return true
        } catch (error) {
            console.error('Error toggling bookmark:', error)
            toast.add({
                title: 'ブックマークの変更に失敗しました',
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
        bookmarks,
        status,
        refresh,
        toggle,
        getBookmarkStatus,
    }
}
