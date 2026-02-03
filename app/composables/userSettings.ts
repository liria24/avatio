export const useUserSettings = () => {
    const toast = useToast()

    const updateProfile = async (username: string, data: Record<string, unknown>) => {
        try {
            await $fetch(`/api/users/${username}`, {
                method: 'PUT',
                body: data,
            })
            toast.add({
                title: 'プロフィールが保存されました',
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error saving profile:', error)
            toast.add({
                title: '保存に失敗しました',
                description: 'プロフィールの保存中にエラーが発生しました。',
                color: 'error',
            })
            return false
        }
    }

    const validateAndAddLink = (links: string[], newLink: string) => {
        const trimmedLink = newLink.trim()
        if (!trimmedLink) {
            return { success: false, error: 'empty' }
        }

        try {
            new URL(trimmedLink)
        } catch {
            toast.add({
                title: '無効なリンク',
                description: '正しいURLを入力してください。',
                color: 'error',
            })
            return { success: false, error: 'invalid' }
        }

        if (links.includes(trimmedLink)) {
            toast.add({
                title: 'リンクがすでに存在します',
                description: '同じリンクは追加できません。',
                color: 'warning',
            })
            return { success: false, error: 'duplicate' }
        }

        return { success: true, link: trimmedLink }
    }

    const uploadImage = async (file: File, path = 'avatar') => {
        try {
            const formData = new FormData()
            formData.append('blob', file)
            formData.append('path', path)

            const response = await $fetch<{ url: string }>('/api/images', {
                method: 'POST',
                body: formData,
            })
            return response.url
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.add({
                title: '画像のアップロードに失敗しました',
                color: 'error',
            })
            return null
        }
    }

    const updateUsername = async (currentUsername: string, newUsername: string) => {
        try {
            await $fetch(`/api/users/${currentUsername}`, {
                method: 'PUT',
                body: { username: newUsername },
            })
            toast.add({
                title: 'ユーザーIDが変更されました',
                description: 'ページを更新しています...',
                progress: false,
            })
            return true
        } catch (error) {
            console.error('Error updating user ID:', error)
            toast.add({
                title: 'ユーザーIDの変更に失敗しました',
                description: 'ユーザーIDの変更中にエラーが発生しました。',
                color: 'error',
            })
            return false
        }
    }

    return {
        updateProfile,
        validateAndAddLink,
        uploadImage,
        updateUsername,
    }
}
