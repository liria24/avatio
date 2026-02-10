export const useUserSettings = () => {
    const toast = useToast()
    const { auth } = useAuth()

    // Profile state - using useState for cross-component sharing
    const profileState = useState<{
        username: string
        name: string
        image: string | null
        bio: string
        links: string[]
    }>('user-settings-profile', () => ({
        username: '',
        name: '',
        image: null,
        bio: '',
        links: [],
    }))

    const profileUI = useState('user-settings-profile-ui', () => ({
        newLink: '',
        imageUploading: false,
        profileUpdating: false,
    }))

    // Shop state
    const shopState = useState('user-settings-shop', () => ({
        itemUrl: '',
        verifyCode: null as string | null,
        verifying: false,
        unverifying: false,
        modalVerify: false,
        modalUnverify: false,
    }))

    // Account state
    const accountState = useState('user-settings-account', () => ({
        modalDeleteUser: false,
    }))

    // Profile operations
    const initializeProfile = async (username: string) => {
        const { data } = await useUser(username)
        if (!data.value) return

        profileState.value = {
            username: data.value.username || '',
            name: data.value.name || '',
            image: data.value.image || null,
            bio: data.value.bio || '',
            links: data.value.links || [],
        }
    }

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

    const addLink = () => {
        const trimmedLink = profileUI.value.newLink.trim()
        if (!trimmedLink) return

        try {
            new URL(trimmedLink)
        } catch {
            toast.add({
                title: '無効なリンク',
                description: '正しいURLを入力してください。',
                color: 'error',
            })
            return
        }

        if (profileState.value.links.includes(trimmedLink)) {
            toast.add({
                title: 'リンクがすでに存在します',
                description: '同じリンクは追加できません。',
                color: 'warning',
            })
            return
        }

        profileState.value.links.push(trimmedLink)
        profileUI.value.newLink = ''
    }

    const removeLink = (index: number) => {
        if (index < 0 || index >= profileState.value.links.length) return
        profileState.value.links.splice(index, 1)
    }

    const submitProfile = async (username: string) => {
        profileUI.value.profileUpdating = true

        try {
            await updateProfile(username, profileState.value)
        } catch (error) {
            console.error('Error saving profile:', error)
        } finally {
            profileUI.value.profileUpdating = false
        }
    }

    const removeUserImage = async (username: string) => {
        try {
            await updateProfile(username, { image: null })
            profileState.value.image = null
        } catch (error) {
            console.error('Error removing user image:', error)
        }
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

    const processProfileImage = async (file: File, username: string) => {
        profileUI.value.imageUploading = true

        try {
            const imageUrl = await uploadImage(file, 'avatar')
            if (!imageUrl) return

            await updateProfile(username, { image: imageUrl })
            profileState.value.image = imageUrl
        } catch (error) {
            console.error('Failed to upload image:', error)
        } finally {
            profileUI.value.imageUploading = false
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

    // Shop operations
    const {
        verify: verifyShop,
        unverify: unverifyShop,
        generateVerificationCode,
    } = useShopVerification()

    const verifiable = computed(() => {
        const result = extractItemId(shopState.value.itemUrl)
        return result?.platform === 'booth'
    })

    const shopUrl = (shopId: string, platform: Platform) => {
        if (platform === 'booth') return `https://${shopId}.booth.pm`
        return undefined
    }

    const verify = async () => {
        if (!verifiable.value) return

        shopState.value.verifying = true

        try {
            const success = await verifyShop(shopState.value.itemUrl)
            if (success) {
                shopState.value.modalVerify = false
                return true
            }
            return false
        } finally {
            shopState.value.verifying = false
        }
    }

    const unverify = async (shopId: string) => {
        shopState.value.unverifying = true

        try {
            const success = await unverifyShop(shopId)
            if (success) {
                shopState.value.modalUnverify = false
                return true
            }
            return false
        } finally {
            shopState.value.unverifying = false
        }
    }

    const initializeShopVerification = () => {
        watch(
            () => shopState.value.modalVerify,
            async (value) => {
                if (value) {
                    const code = await generateVerificationCode()
                    shopState.value.verifyCode = code
                } else {
                    shopState.value.verifyCode = null
                }
            }
        )
    }

    // Account operations
    const deleteUser = async () => {
        const localePath = useLocalePath()
        try {
            await auth.deleteUser({ callbackURL: localePath('/') })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'アカウントを削除しました',
                description: 'ページをリロードしています...',
                color: 'success',
            })
            navigateTo(localePath('/'), { external: true })
        } catch (error) {
            console.error('Error deleting user:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'アカウントを削除できませんでした',
                description: '時間をおいて再度お試しください。',
                color: 'error',
            })
        }
    }

    return {
        // Profile
        profileState,
        profileUI,
        initializeProfile,
        updateProfile,
        addLink,
        removeLink,
        submitProfile,
        removeUserImage,
        uploadImage,
        processProfileImage,
        updateUsername,
        // Shop
        shopState,
        verifiable,
        shopUrl,
        verify,
        unverify,
        initializeShopVerification,
        // Account
        accountState,
        deleteUser,
    }
}
