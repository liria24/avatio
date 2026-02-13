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

    const { data, refresh, status } = useFetch('/api/notifications', {
        dedupe: 'defer',
        immediate: !!session.value,
        default: () => ({
            unread: 0,
            data: [],
        }),
    })

    const notifications = computed(() => {
        const allNotifications = data.value?.data || []
        const { read, unread } = opts.value
        return allNotifications.filter((n) => {
            const isRead = !!n.readAt
            if (isRead && !read) return false
            if (!isRead && !unread) return false
            return true
        })
    })

    const unreadCount = computed(() => data.value?.unread || 0)

    const markAsRead = async (id: string) => {
        try {
            await $fetch('/api/notifications/read', {
                method: 'POST',
                body: { id },
            })
            await refresh()
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
            await refresh()
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
        notifications,
        refresh,
        status,
        unreadCount,
        markAsRead,
        markAsUnread,
        open,
    }
}
