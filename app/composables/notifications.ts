interface UseNotificationsOptions {
    read?: boolean
    unread?: boolean
}

export const useNotifications = (options?: MaybeRefOrGetter<UseNotificationsOptions>) => {
    const { session } = useAuth()
    const localePath = useLocalePath()

    const opts = computed(() => {
        const value = toValue(options) || {}
        return {
            read: value.read ?? false,
            unread: value.unread ?? true,
        }
    })

    const _asyncData = useFetch('/api/notifications', {
        key: 'notifications',
        dedupe: 'defer',
        immediate: !!session.value,
        transform: (response) => {
            const allNotifications = response.data
            const { read, unread } = opts.value
            return {
                notifications: allNotifications.filter((n) => {
                    const isRead = !!n.readAt
                    if (isRead && !read) return false
                    if (!isRead && !unread) return false
                    return true
                }),
                unreadCount: response.unread,
            }
        },
        default: () => ({
            notifications: [],
            unreadCount: 0,
        }),
        getCachedData: (key, n, ctx) =>
            ctx.cause !== 'refresh:manual' ? n.payload.data[key] : n.static.data[key],
    })

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

    return Object.assign(_asyncData, {
        markAsRead,
        markAsUnread,
        open,
    })
}
