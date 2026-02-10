export const useAdminActions = () => {
    const { t } = useI18n()
    const toast = useToast()

    const resolveReport = async (
        type: 'setup' | 'user' | 'item',
        id: number,
        isResolved = true
    ) => {
        try {
            await $fetch(`/api/admin/reports/${type}/${id}`, {
                method: 'PATCH',
                body: { isResolved },
            })
            toast.add({
                title: isResolved
                    ? t('toast.admin.reportResolved')
                    : t('toast.admin.reportUnresolved'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error resolving report:', error)
            toast.add({
                title: t('toast.admin.error'),
                color: 'error',
            })
            return false
        }
    }

    const banUser = async (userId: string) => {
        try {
            await $fetch(`/api/admin/user/${userId}`, {
                method: 'PATCH',
                body: { ban: true },
            })
            toast.add({
                title: t('toast.admin.userBanned'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error banning user:', error)
            toast.add({
                title: t('toast.admin.userBanFailed'),
                color: 'error',
            })
            return false
        }
    }

    const unbanUser = async (userId: string) => {
        try {
            await $fetch(`/api/admin/user/${userId}`, {
                method: 'PATCH',
                body: { ban: false },
            })
            toast.add({
                title: t('toast.admin.userUnbanned'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error unbanning user:', error)
            toast.add({
                title: t('toast.admin.userUnbanFailed'),
                color: 'error',
            })
            return false
        }
    }

    const closeFeedback = async (feedbackId: number) => {
        try {
            await $fetch(`/api/admin/feedbacks/${feedbackId}`, {
                method: 'PATCH',
                body: { isClosed: true },
            })
            toast.add({
                title: t('toast.admin.feedbackClosed'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error closing feedback:', error)
            toast.add({
                title: t('toast.admin.feedbackCloseFailed'),
                color: 'error',
            })
            return false
        }
    }

    const openFeedback = async (feedbackId: number) => {
        try {
            await $fetch(`/api/admin/feedbacks/${feedbackId}`, {
                method: 'PATCH',
                body: { isClosed: false },
            })
            toast.add({
                title: t('toast.admin.feedbackOpened'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error opening feedback:', error)
            toast.add({
                title: t('toast.admin.feedbackOpenFailed'),
                color: 'error',
            })
            return false
        }
    }

    const hideSetup = async (setupId: number, hideReason?: string) => {
        try {
            await $fetch(`/api/admin/setup/${setupId}`, {
                method: 'PATCH',
                body: {
                    hide: true,
                    hideReason: hideReason?.length ? hideReason : undefined,
                },
            })
            toast.add({
                title: t('toast.admin.setupHidden'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error hiding setup:', error)
            toast.add({
                title: t('toast.admin.setupHideFailed'),
                color: 'error',
            })
            return false
        }
    }

    const unhideSetup = async (setupId: number) => {
        try {
            await $fetch(`/api/admin/setup/${setupId}`, {
                method: 'PATCH',
                body: { hide: false },
            })
            toast.add({
                title: t('toast.admin.setupUnhidden'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error unhiding setup:', error)
            toast.add({
                title: t('toast.admin.setupUnhideFailed'),
                color: 'error',
            })
            return false
        }
    }

    const deleteSetup = async (setupId: number) => {
        try {
            await $fetch(`/api/setups/${setupId}`, {
                method: 'DELETE',
            })
            toast.add({
                title: t('toast.admin.setupDeleted'),
                description: t('toast.admin.setupDeleteDescription'),
                color: 'success',
            })
            return true
        } catch (error) {
            toast.add({
                title: t('toast.admin.setupDeleteFailed'),
                description:
                    error instanceof Error ? error.message : t('toast.reports.unknownError'),
                color: 'error',
            })
            return false
        }
    }

    const submitFeedback = async (comment: string, contextPath: string) => {
        try {
            await $fetch('/api/feedbacks', {
                method: 'POST',
                body: {
                    comment,
                    contextPath,
                },
            })
            toast.add({
                title: t('toast.admin.feedbackSubmitted'),
                description: t('toast.admin.feedbackSubmittedDescription'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error submitting feedback:', error)
            toast.add({
                title: t('toast.admin.feedbackSubmitFailed'),
                color: 'error',
            })
            return false
        }
    }

    const toggleMaintenanceMode = async (isMaintenance: boolean) => {
        try {
            await $fetch('/api/admin/edge-config', {
                method: 'PUT',
                body: { isMaintenance },
            })
            return true
        } catch (error) {
            console.error('Error toggling maintenance mode:', error)
            toast.add({
                title: t('toast.admin.toggleFailed'),
                color: 'error',
            })
            return false
        }
    }

    const toggleForceUpdateItem = async (forceUpdateItem: boolean) => {
        try {
            await $fetch('/api/admin/edge-config', {
                method: 'PUT',
                body: { forceUpdateItem },
            })
            toast.add({
                title: t('toast.admin.forceUpdateItemToggled'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error changing forceUpdateItem:', error)
            toast.add({
                title: t('toast.admin.forceUpdateItemToggleFailed'),
                color: 'error',
            })
            return false
        }
    }

    const changeItemNiceName = async (itemId: string, niceName: string) => {
        try {
            await $fetch<void>(`/api/admin/items/${transformItemId(itemId).encode()}`, {
                method: 'PUT',
                body: { niceName },
            })
            toast.add({
                title: t('toast.admin.itemNiceNameChanged'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error changing item nice name:', error)
            toast.add({
                title: t('toast.admin.itemNiceNameChangeFailed'),
                color: 'error',
            })
            return false
        }
    }

    const banUserWithReason = async (userId: string, banReason: string, banExpiresIn?: number) => {
        try {
            await $fetch(`/api/admin/user/${userId}`, {
                method: 'PATCH',
                body: {
                    ban: true,
                    banReason,
                    banExpiresIn,
                },
            })
            toast.add({
                title: t('toast.admin.userBanned'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error banning user:', error)
            toast.add({
                title: t('toast.admin.userBanFailed'),
                color: 'error',
            })
            return false
        }
    }

    const createChangelog = async (data: {
        slug: string
        title: string
        markdown: string
        authors: string[]
    }) => {
        try {
            await $fetch('/api/admin/changelogs', {
                method: 'POST',
                body: data,
            })
            toast.add({
                title: t('toast.admin.changelogCreated'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error creating changelog:', error)
            toast.add({
                title: t('toast.admin.changelogCreateFailed'),
                color: 'error',
            })
            return false
        }
    }

    return {
        resolveReport,
        banUser,
        unbanUser,
        closeFeedback,
        openFeedback,
        hideSetup,
        unhideSetup,
        deleteSetup,
        submitFeedback,
        toggleMaintenanceMode,
        toggleForceUpdateItem,
        changeItemNiceName,
        banUserWithReason,
        createChangelog,
    }
}
