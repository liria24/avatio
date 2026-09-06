import type { ViewerContext } from '@avatio/core/users'

const defaultPreferences = {
    showPrivateSetups: true,
    showNsfw: false,
} as const

export const useViewerContext = () => {
    const session = useUserSession()
    const settings = useUserSettings({ immediate: session.loggedIn.value })

    watch(session.loggedIn, (loggedIn) => {
        if (loggedIn) void settings.refresh()
        else settings.clear()
    })

    const viewer = computed<ViewerContext>(() => {
        const identity = session.user.value
            ? {
                  id: session.user.value.id,
                  role: session.user.value.role ?? null,
                  banned: session.user.value.banned ?? false,
              }
            : null
        return {
            identity,
            preferences: settings.data.value
                ? {
                      showPrivateSetups: settings.data.value.showPrivateSetups,
                      showNsfw: settings.data.value.showNSFW,
                  }
                : defaultPreferences,
            capabilities: {
                administerUsers: identity?.role === 'admin',
                moderateCatalog: identity?.role === 'admin',
            },
        }
    })

    return {
        ...session,
        viewer,
        preferences: computed(() => viewer.value.preferences),
        refreshPreferences: settings.refresh,
    }
}
