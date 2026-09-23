const _useNotifications = () => {
    const { loggedIn } = useUserSession()
    const localePath = useLocalePath()

    const { data, status, refresh } = useFetch('/api/notifications', {
        key: 'notifications',
        dedupe: 'defer',
        immediate: loggedIn.value,
        default: () => ({ data: [], unread: 0 }),
        getCachedData: (key, n, ctx) =>
            ctx.cause !== 'refresh:manual' ? n.payload.data[key] : n.static.data[key],
    })

    const all = computed(() => data.value.data)
    const unread = computed(() => all.value.filter((n) => !n.readAt))
    const unreadCount = computed(() => data.value.unread)

    const setRead = async (id: string, read: boolean) => {
        try {
            await $fetch(`/api/notifications/${read ? 'read' : 'unread'}`, {
                method: 'POST',
                body: { id },
            })
            await refresh()
        } catch (error) {
            console.error(`Error marking notification as ${read ? 'read' : 'unread'}:`, error)
            throw error
        }
    }
    const markAsRead = (id: string) => setRead(id, true)
    const markAsUnread = (id: string) => setRead(id, false)

    const open = (id: string, actionUrl: string | null) => {
        void markAsRead(id)
        if (actionUrl) void navigateTo(localePath(actionUrl))
    }

    return {
        all,
        unread,
        unreadCount,
        status,
        markAsRead,
        markAsUnread,
        open,
    }
}

export const useNotifications = createSharedComposable(_useNotifications)
