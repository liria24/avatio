interface ProfileState {
    username: string
    name: string
    image: string | null
    bio: string
    links: string[]
}

export const useUserSettingsProfile = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { session } = useAuth()
    const username = computed(() => session.value?.user.username || '')
    const { userData, refreshUserData } = useCurrentUser()

    const state = useState<ProfileState>('user-settings-profile-state', () => ({
        username: '',
        name: '',
        image: null,
        bio: '',
        links: [],
    }))
    const updating = useState<boolean>('user-settings-profile-updating', () => false)

    const update = async (username: string, data: Partial<ProfileState>) => {
        try {
            await $fetch(`/api/users/${username}`, {
                method: 'PUT',
                body: data,
            })
            toast.add({
                title: t('toast.userSettings.profileSaved'),
                color: 'success',
            })
            return true
        } catch (error) {
            console.error('Error saving profile:', error)
            toast.add({
                title: t('toast.userSettings.saveFailed'),
                description: t('toast.userSettings.saveFailedDescription'),
                color: 'error',
            })
            return false
        }
    }

    const processImage = async (file: File) => {
        if (!username.value) return

        updating.value = true

        try {
            const imageUrl = await uploadImage(file, 'avatar')
            if (!imageUrl) return

            await update(username.value, { image: imageUrl })
            state.value.image = imageUrl
        } catch (error) {
            console.error('Failed to upload image:', error)
        } finally {
            updating.value = false
        }
    }

    const save = async () => {
        if (!username.value) return false

        updating.value = true

        try {
            return await update(username.value, state.value)
        } catch (error) {
            console.error('Error saving profile:', error)
            return false
        } finally {
            updating.value = false
        }
    }

    const addLink = (link: string) => {
        const trimmedLink = link.trim()
        if (!trimmedLink) return false

        try {
            new URL(trimmedLink)
        } catch {
            toast.add({
                title: t('toast.userSettings.invalidLink'),
                description: t('toast.userSettings.invalidLinkDescription'),
                color: 'error',
            })
            return false
        }

        if (state.value.links.includes(trimmedLink)) {
            toast.add({
                title: t('toast.userSettings.linkExists'),
                description: t('toast.userSettings.linkExistsDescription'),
                color: 'warning',
            })
            return false
        }

        state.value.links.push(trimmedLink)
        return true
    }

    const removeLink = (index: number) => {
        if (index < 0 || index >= state.value.links.length) return
        state.value.links.splice(index, 1)
    }

    const selectImage = () => {
        const { open, reset, onChange } = useFileDialog({
            accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
            multiple: false,
            directory: false,
        })

        onChange(async (files) => {
            if (!files?.length || !files[0]) return
            await processImage(files[0])
            reset()
        })

        return { open }
    }

    const removeImage = async () => {
        if (!username.value) return

        try {
            await update(username.value, { image: null })
            state.value.image = null
        } catch (error) {
            console.error('Error removing user image:', error)
        }
    }

    const syncProfileData = async () => {
        try {
            await refreshUserData()

            // Sync profile state
            state.value.username = userData.value?.username || ''
            state.value.name = userData.value?.name || ''
            state.value.image = userData.value?.image || null
            state.value.bio = userData.value?.bio || ''
            state.value.links = userData.value?.links || []
        } catch (error) {
            console.error('Error fetching user data:', error)
        }
    }

    const updateUsername = async (newUsername: string) => {
        if (!username.value) return false

        try {
            await $fetch(`/api/users/${username.value}`, {
                method: 'PUT',
                body: { username: newUsername },
            })
            toast.add({
                title: t('toast.userSettings.usernameChanged'),
                description: t('toast.userSettings.usernameChangeDescription'),
                progress: false,
            })
            return true
        } catch (error) {
            console.error('Error updating user ID:', error)
            toast.add({
                title: t('toast.userSettings.usernameChangeFailed'),
                description: t('toast.userSettings.usernameChangeFailedDescription'),
                color: 'error',
            })
            return false
        }
    }

    return {
        state,
        updating,
        userData,
        save,
        link: {
            add: addLink,
            remove: removeLink,
        },
        image: {
            select: selectImage,
            remove: removeImage,
        },
        updateUsername,
        syncProfileData,
    }
}

export const useUserSettingsShop = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { userData, refreshUserData } = useCurrentUser()

    const state = useState('user-settings-shop-state', () => ({
        itemUrl: '',
        verifyCode: null as string | null,
        verifying: false,
        unverifying: false,
    }))

    const generateVerificationCode = async () => {
        try {
            const data = await $fetch<{ code: string }>('/api/shop-verification/code')
            return data.code
        } catch (error) {
            console.error('Error generating verification code:', error)
            return null
        }
    }

    const verifiable = computed(() => {
        const result = extractItemId(state.value.itemUrl)
        return result?.platform === 'booth'
    })

    const verify = async () => {
        if (!verifiable.value) return false

        state.value.verifying = true

        try {
            await $fetch('/api/shop-verification', {
                method: 'POST',
                body: { url: state.value.itemUrl },
            })
            toast.add({ title: t('toast.userSettings.shopVerified'), color: 'success' })
            await refreshUserData()
            return true
        } catch (error) {
            console.error('Error verifying shop:', error)
            toast.add({ title: t('toast.userSettings.shopVerifyFailed'), color: 'error' })
            return false
        } finally {
            state.value.verifying = false
        }
    }

    const unverify = async (shopId: string) => {
        state.value.unverifying = true

        try {
            await $fetch('/api/shop-verification', {
                method: 'DELETE',
                body: { shopId },
            })
            toast.add({ title: t('toast.userSettings.shopUnverified'), color: 'success' })
            await refreshUserData()
            return true
        } catch (error) {
            console.error('Error unverifying shop:', error)
            toast.add({ title: t('toast.userSettings.shopUnverifyFailed'), color: 'error' })
            return false
        } finally {
            state.value.unverifying = false
        }
    }

    return {
        userData,
        state,
        verifiable,
        url: (shopId: string, platform: Platform) => {
            if (platform === 'booth') return `https://${shopId}.booth.pm`
            return undefined
        },
        generateVerificationCode,
        verify,
        unverify,
    }
}

export const useUserSettingsAccount = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { auth } = useAuth()

    const deleteUser = async () => {
        const localePath = useLocalePath()
        try {
            await auth.deleteUser({ callbackURL: localePath('/') })

            toast.add({
                icon: 'mingcute:check-line',
                title: t('toast.userSettings.accountDeleted'),
                description: t('toast.userSettings.accountDeleteDescription'),
                color: 'success',
            })
            navigateTo(localePath('/'), { external: true })
        } catch (error) {
            console.error('Error deleting user:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('toast.userSettings.accountDeleteFailed'),
                description: t('toast.userSettings.accountDeleteFailedDescription'),
                color: 'error',
            })
        }
    }

    return { deleteUser }
}
