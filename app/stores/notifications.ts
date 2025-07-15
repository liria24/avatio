import type { Notification } from '#imports'

export const useNotificationsStore = defineStore('notificationsStore', {
    state: () => ({
        notifications: [] as Notification[],
        unread: 0,
        fetching: false,
    }),
    actions: {
        async fetch() {
            this.fetching = true
            const { data } = await useNotifications()
            this.notifications = data.value?.data || []
            this.unread = data.value?.unread || 0
            this.fetching = false
        },
    },
})
