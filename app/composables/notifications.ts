const _useNotifications = () => {
    const { session } = useAuth()
    const localePath = useLocalePath()

    const _asyncData = useFetch('/api/notifications', {
        key: 'notifications',
        dedupe: 'defer',
        immediate: !!session.value,
        transform: (response) => response,
        default: () => ({ data: [], unread: 0 }),
        getCachedData: (key, n, ctx) =>
            ctx.cause !== 'refresh:manual' ? n.payload.data[key] : n.static.data[key],
    })

    const all = computed(() => _asyncData.data.value.data)
    const read = computed(() => all.value.filter((n) => !!n.readAt))
    const unread = computed(() => all.value.filter((n) => !n.readAt))
    const unreadCount = computed(() => _asyncData.data.value.unread)

    const markAsRead = async (id: string) => {
        try {
            await $fetch('/api/notifications/read', {
                method: 'POST',
                body: { id },
            })
            await _asyncData.refresh()
        } catch (error) {
            console.error('Error marking notification as read:', error)
            throw error
        }
    }

    const markAsUnread = async (id: string) => {
        try {
            await $fetch('/api/notifications/unread', {
                method: 'POST',
                body: { id },
            })
            await _asyncData.refresh()
        } catch (error) {
            console.error('Error marking notification as unread:', error)
            throw error
        }
    }

    const open = (id: string, actionUrl: string | null) => {
        markAsRead(id)
        if (actionUrl) navigateTo(localePath(actionUrl))
    }

    return {
        ..._asyncData,
        all,
        read,
        unread,
        unreadCount,
        markAsRead,
        markAsUnread,
        open,
    }
}

export const useNotifications = createSharedComposable(_useNotifications)
