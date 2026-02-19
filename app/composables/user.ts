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
    useFetch<Serialized<User>[]>(`/api/users/${username}/followees`, {
        key: computed(() => `user-${unref(username)}-followees`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    })

export const useUserFollowers = (username: string) =>
    useFetch<Serialized<User>[]>(`/api/users/${username}/followers`, {
        key: computed(() => `user-${unref(username)}-followers`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    })

export const useUserFollow = (username: MaybeRef<string>) => {
    const { t } = useI18n()
    const toast = useToast()

    const { data: user } = useUser(unref(username))
    const localOverride = useState<boolean | null>(`follow-${unref(username)}`, () => null)

    const isFollowing = computed(() =>
        localOverride.value !== null ? localOverride.value : (user.value?.isFollowing ?? false),
    )

    const follow = async () => {
        localOverride.value = true
        try {
            await $fetch(`/api/users/${unref(username)}/follow`, { method: 'POST' })
        } catch (error) {
            console.error('Error following user:', error)
            localOverride.value = null
            toast.add({ title: t('toast.follow.followFailed'), color: 'error' })
        }
    }

    const unfollow = async () => {
        localOverride.value = false
        try {
            await $fetch(`/api/users/${unref(username)}/follow`, { method: 'DELETE' })
        } catch (error) {
            console.error('Error unfollowing user:', error)
            localOverride.value = null
            toast.add({ title: t('toast.follow.unfollowFailed'), color: 'error' })
        }
    }

    const check = async () => {
        try {
            const data = await $fetch<Serialized<User>>(`/api/users/${unref(username)}`)
            localOverride.value = data.isFollowing ?? false
        } catch (error) {
            console.error('Error checking follow status:', error)
        }
    }

    return { isFollowing, follow, unfollow, check }
}
