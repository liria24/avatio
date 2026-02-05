export const useAdminActions = () => {
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
                title: isResolved ? 'Marked as Resolved' : 'Marked as Unresolved',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error resolving report:', error)
            toast.add({
                title: 'Error',
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
                title: 'ユーザーをBANしました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error banning user:', error)
            toast.add({
                title: 'ユーザーのBANに失敗しました',
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
                title: 'ユーザーのBANを解除しました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error unbanning user:', error)
            toast.add({
                title: 'ユーザーのBAN解除に失敗しました',
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
                title: 'フィードバックをクローズしました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error closing feedback:', error)
            toast.add({
                title: 'フィードバックのクローズに失敗しました',
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
                title: 'フィードバックをオープンしました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error opening feedback:', error)
            toast.add({
                title: 'フィードバックのオープンに失敗しました',
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
                title: 'セットアップが非表示になりました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error hiding setup:', error)
            toast.add({
                title: 'セットアップの非表示に失敗しました',
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
                title: 'セットアップが再表示されました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error unhiding setup:', error)
            toast.add({
                title: 'セットアップの再表示に失敗しました',
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
                title: 'セットアップが削除されました',
                description: 'セットアップが正常に削除されました。',
                color: 'success',
            })
            return true
        } catch (error) {
            toast.add({
                title: 'セットアップの削除に失敗しました',
                description: error instanceof Error ? error.message : '不明なエラーが発生しました',
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
                title: 'フィードバックが送信されました',
                description: 'ご協力ありがとうございます。',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error submitting feedback:', error)
            toast.add({
                title: 'フィードバックの送信に失敗しました',
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
                title: '切替えに失敗しました',
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
                title: 'アイテム情報の強制更新を切り替えました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error changing forceUpdateItem:', error)
            toast.add({
                title: '切換えに失敗しました',
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
                title: 'アイテムの名称を変更しました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error changing item nice name:', error)
            toast.add({
                title: 'アイテムの名称の変更に失敗しました',
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
                title: 'ユーザーをBANしました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error banning user:', error)
            toast.add({
                title: 'ユーザーのBANに失敗しました',
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
                title: 'Changelog created successfully',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error creating changelog:', error)
            toast.add({
                title: 'Failed to create changelog',
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
