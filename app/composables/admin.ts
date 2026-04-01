export const useAdmin = () => {
    const { t } = useI18n()
    const toast = useToast()

    type ActionConfig<T extends object> = {
        url: (params: T) => string
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        body?: (params: T) => Record<string, unknown>
        successTitle?: string | ((params: T) => string)
        errorTitle: string
        errorLog: string
        refreshSummary?: boolean
    }

    const defineAction =
        <T extends object>(config: ActionConfig<T>) =>
        async (params: T & { onSuccess?: () => void }) => {
            await $fetch(config.url(params as T), {
                method: config.method,
                body: config.body?.(params as T),
                onResponse({ response }) {
                    if (!response.ok) return
                    if (config.successTitle) {
                        const title =
                            typeof config.successTitle === 'function'
                                ? config.successTitle(params as T)
                                : config.successTitle
                        toast.add({ title, color: 'success' })
                    }
                    if (config.refreshSummary) refreshNuxtData('admin-summary')
                    params.onSuccess?.()
                },
                onResponseError({ error }) {
                    console.error(config.errorLog, error)
                    toast.add({ title: config.errorTitle, color: 'error' })
                },
            })
        }

    const resolveReport = defineAction<{
        type: 'setup' | 'user' | 'item'
        id: number
        isResolved?: boolean
    }>({
        url: ({ type, id }) => `/api/admin/reports/${type}/${id}`,
        method: 'PATCH',
        body: ({ isResolved }) => ({ isResolved: isResolved ?? true }),
        successTitle: ({ isResolved }) =>
            (isResolved ?? true)
                ? t('toast.admin.reportResolved')
                : t('toast.admin.reportUnresolved'),
        errorTitle: t('toast.admin.error'),
        errorLog: 'Error resolving report:',
        refreshSummary: true,
    })

    const banUser = defineAction<{ userId: string }>({
        url: ({ userId }) => `/api/admin/user/${userId}`,
        method: 'PATCH',
        body: () => ({ ban: true }),
        successTitle: t('toast.admin.userBanned'),
        errorTitle: t('toast.admin.userBanFailed'),
        errorLog: 'Error banning user:',
    })

    const unbanUser = defineAction<{ userId: string }>({
        url: ({ userId }) => `/api/admin/user/${userId}`,
        method: 'PATCH',
        body: () => ({ ban: false }),
        successTitle: t('toast.admin.userUnbanned'),
        errorTitle: t('toast.admin.userUnbanFailed'),
        errorLog: 'Error unbanning user:',
    })

    const closeFeedback = defineAction<{ feedbackId: number }>({
        url: ({ feedbackId }) => `/api/admin/feedbacks/${feedbackId}`,
        method: 'PATCH',
        body: () => ({ isClosed: true }),
        successTitle: t('toast.admin.feedbackClosed'),
        errorTitle: t('toast.admin.feedbackCloseFailed'),
        errorLog: 'Error closing feedback:',
        refreshSummary: true,
    })

    const openFeedback = defineAction<{ feedbackId: number }>({
        url: ({ feedbackId }) => `/api/admin/feedbacks/${feedbackId}`,
        method: 'PATCH',
        body: () => ({ isClosed: false }),
        successTitle: t('toast.admin.feedbackOpened'),
        errorTitle: t('toast.admin.feedbackOpenFailed'),
        errorLog: 'Error opening feedback:',
        refreshSummary: true,
    })

    const hideSetup = defineAction<{ setupId: Setup['id']; hideReason?: string }>({
        url: ({ setupId }) => `/api/admin/setups/${setupId}`,
        method: 'PATCH',
        body: ({ hideReason }) => ({
            hide: true,
            hideReason: hideReason?.length ? hideReason : undefined,
        }),
        successTitle: t('toast.admin.setupHidden'),
        errorTitle: t('toast.admin.setupHideFailed'),
        errorLog: 'Error hiding setup:',
    })

    const unhideSetup = defineAction<{ setupId: Setup['id'] }>({
        url: ({ setupId }) => `/api/admin/setups/${setupId}`,
        method: 'PATCH',
        body: () => ({ hide: false }),
        successTitle: t('toast.admin.setupUnhidden'),
        errorTitle: t('toast.admin.setupUnhideFailed'),
        errorLog: 'Error unhiding setup:',
    })

    const toggleMaintenanceMode = defineAction<{ isMaintenance: boolean }>({
        url: () => '/api/admin/edge-config',
        method: 'PUT',
        body: ({ isMaintenance }) => ({ isMaintenance }),
        errorTitle: t('toast.admin.toggleFailed'),
        errorLog: 'Error toggling maintenance mode:',
    })

    const toggleForceUpdateItem = defineAction<{ forceUpdateItem: boolean }>({
        url: () => '/api/admin/edge-config',
        method: 'PUT',
        body: ({ forceUpdateItem }) => ({ forceUpdateItem }),
        successTitle: t('toast.admin.forceUpdateItemToggled'),
        errorTitle: t('toast.admin.forceUpdateItemToggleFailed'),
        errorLog: 'Error changing forceUpdateItem:',
    })

    const changeItemNiceName = defineAction<{ itemId: string; niceName: string }>({
        url: ({ itemId }) => `/api/admin/items/${itemId}`,
        method: 'PUT',
        body: ({ niceName }) => ({ niceName }),
        successTitle: t('toast.admin.itemNiceNameChanged'),
        errorTitle: t('toast.admin.itemNiceNameChangeFailed'),
        errorLog: 'Error changing item nice name:',
    })

    const banUserWithReason = defineAction<{
        userId: string
        banReason: string
        banExpiresIn?: number
    }>({
        url: ({ userId }) => `/api/admin/user/${userId}`,
        method: 'PATCH',
        body: ({ banReason, banExpiresIn }) => ({ ban: true, banReason, banExpiresIn }),
        successTitle: t('toast.admin.userBanned'),
        errorTitle: t('toast.admin.userBanFailed'),
        errorLog: 'Error banning user:',
    })

    const createChangelog = defineAction<{ title: string; markdown: string }>({
        url: () => '/api/admin/changelogs',
        method: 'POST',
        body: ({ title, markdown }) => ({ title, markdown }),
        successTitle: t('toast.admin.changelogCreated'),
        errorTitle: t('toast.admin.changelogCreateFailed'),
        errorLog: 'Error creating changelog:',
    })

    const getSummary = () =>
        useFetch('/api/admin/summary', { key: 'admin-summary', dedupe: 'defer' })

    return {
        resolveReport,
        banUser,
        unbanUser,
        closeFeedback,
        openFeedback,
        hideSetup,
        unhideSetup,
        toggleMaintenanceMode,
        toggleForceUpdateItem,
        changeItemNiceName,
        banUserWithReason,
        createChangelog,
        getSummary,
    }
}
