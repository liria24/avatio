export const purgeSetupCache = async (id: Setup['id']) => {
    const keys = await useStorage('cache').keys(`nitro:functions:setup:${id}`)
    await Promise.all([
        useStorage('cache').del(`nitro:functions:setup:${id}.json`),
        ...keys.map((key) => useStorage('cache').del(key)),
    ])
}

type SetupCacheVisibility = {
    id: Setup['id']
    userId: string
    hidAt: Date | null
}

type SetupCacheSession =
    | {
          user: {
              id: string
              role?: string | null
          }
      }
    | null
    | undefined

export const getSetupCacheKey = (
    setup: SetupCacheVisibility,
    session: SetupCacheSession,
): string | null => {
    if (!setup.hidAt) return setup.id
    if (session?.user.role === 'admin' || session?.user.id === setup.userId)
        return `${setup.id}:hidden`

    return null
}

export const purgeUserCache = async (id: string) => {
    const keys = await useStorage('cache').keys(`nitro:functions:user:${id}`)
    await Promise.all([
        useStorage('cache').del(`nitro:functions:user:${id}.json`),
        useStorage('cache').del(`nitro:functions:user:${id}:banned.json`),
        ...keys.map((key) => useStorage('cache').del(key)),
    ])
}

type UserCacheVisibility = {
    id: User['id']
    banned: boolean | null
}

type UserCacheSession =
    | {
          user: {
              id: string
              role?: string | null
          }
      }
    | null
    | undefined

export const getUserCacheKey = (
    user: UserCacheVisibility,
    session: UserCacheSession,
): string | null => {
    if (!user.banned) return user.id
    if (session?.user.role === 'admin' || session?.user.id === user.id) return `${user.id}:banned`

    return null
}
