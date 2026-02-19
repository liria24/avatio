import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (username: string, options?: UseFetchOptions<Serialized<User>>) => {
    const defaultOptions: UseFetchOptions<Serialized<User>> = {
        key: computed(() => `user-${unref(username)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<Serialized<User>>(`/api/users/${username}`, {
        ...defaultOptions,
        ...options,
    })
}

export const useCurrentUser = () => {
    const { session } = useAuth()
    return useUser(session.value?.user.username || '')
}

export const useUserFollowees = (username: string) =>
    useFetch(`/api/users/${username}/followees`, {
        key: computed(() => `user-${unref(username)}-followees`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    })

export const useUserFollowers = (username: string) =>
    useFetch(`/api/users/${username}/followers`, {
        key: computed(() => `user-${unref(username)}-followers`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    })

export const useUserFollow = (username: string) => {
    const toast = useToast()
    const { t } = useI18n()

    const _asyncData = useFetch(`/api/users/${username}/follow`, {
        key: computed(() => `user-${unref(username)}-isFollowing`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        transform: (data) => data.isFollowing,
    })

    const followLocalOverride = useState<boolean | null>(`follow-${unref(username)}`, () => null)
    const isFollowing = computed(() =>
        followLocalOverride.value !== null
            ? followLocalOverride.value
            : (_asyncData.data.value ?? false),
    )

    const follow = async () => {
        followLocalOverride.value = true
        try {
            await $fetch(`/api/users/${unref(username)}/follow`, { method: 'POST' })
        } catch (error) {
            console.error('Error following user:', error)
            followLocalOverride.value = null
            toast.add({
                icon: 'mingcute:close-line',
                title: t('toast.follow.followFailed'),
                color: 'error',
            })
        }
    }

    const unfollow = async () => {
        followLocalOverride.value = false
        try {
            await $fetch(`/api/users/${unref(username)}/follow`, { method: 'DELETE' })
        } catch (error) {
            console.error('Error unfollowing user:', error)
            followLocalOverride.value = null
            toast.add({
                icon: 'mingcute:close-line',
                title: t('toast.follow.unfollowFailed'),
                color: 'error',
            })
        }
    }

    const awaitableResult = Object.assign(_asyncData, {
        follow,
        unfollow,
        isFollowing,
    })

    return awaitableResult
}

export const useUserMute = (username: string) => {
    const toast = useToast()

    const _asyncData = useFetch(`/api/users/${username}/mute`, {
        key: computed(() => `user-${unref(username)}-isMuted`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        transform: (data) => data.isMuted,
    })

    const muteLocalOverride = useState<boolean | null>(`mute-${unref(username)}`, () => null)
    const isMuted = computed(() =>
        muteLocalOverride.value !== null
            ? muteLocalOverride.value
            : (_asyncData.data.value ?? false),
    )

    const mute = async () => {
        muteLocalOverride.value = true
        try {
            await $fetch(`/api/users/${unref(username)}/mute`, { method: 'POST' })
            toast.add({
                icon: 'mingcute:check-line',
                title: 'ユーザーをミュートしました',
                color: 'success',
            })
        } catch (error) {
            console.error('Error muting user:', error)
            muteLocalOverride.value = null
            toast.add({
                icon: 'mingcute:close-line',
                title: 'ミュートに失敗しました',
                color: 'error',
            })
        }
    }

    const unmute = async () => {
        muteLocalOverride.value = false
        try {
            await $fetch(`/api/users/${unref(username)}/mute`, { method: 'DELETE' })
            toast.add({
                icon: 'mingcute:check-line',
                title: 'ユーザーのミュートを解除しました',
                color: 'success',
            })
        } catch (error) {
            console.error('Error unmuting user:', error)
            muteLocalOverride.value = null
            toast.add({
                icon: 'mingcute:close-line',
                title: 'ミュート解除に失敗しました',
                color: 'error',
            })
        }
    }

    const awaitableResult = Object.assign(_asyncData, {
        mute,
        unmute,
        isMuted,
    })

    return awaitableResult
}
