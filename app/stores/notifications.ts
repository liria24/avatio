import type { Notification } from '#imports'

interface NotificationResponse {
    data: Notification[]
    unread: number
}

export const useNotificationsStore = defineStore('notificationsStore', {
    state: () => ({
        notifications: [] as Notification[],
        unread: 0,
        fetching: false,
    }),
    actions: {
        async fetch() {
            this.fetching = true
            try {
                const response = await $fetch<NotificationResponse>('/api/notifications')
                this.notifications = response.data || []
                this.unread = response.unread || 0
            } catch (error) {
                console.error('Error fetching notifications:', error)
                this.notifications = []
                this.unread = 0
            } finally {
                this.fetching = false
            }
        },
        async markAsRead(id: string) {
            try {
                await $fetch('/api/notifications/read', {
                    method: 'POST',
                    body: { id },
                })
                await this.fetch()
            } catch (error) {
                console.error('Error marking notification as read:', error)
                throw error
            }
        },
        async markAsUnread(id: string) {
            try {
                await $fetch('/api/notifications/unread', {
                    method: 'POST',
                    body: { id },
                })
                await this.fetch()
            } catch (error) {
                console.error('Error marking notification as unread:', error)
                throw error
            }
        },
    },
})
