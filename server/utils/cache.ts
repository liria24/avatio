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
    await useStorage('cache').del(`nitro:functions:user:${id}.json`)
}

export const defineCacheControl = (options: { cdnAge?: number; clientAge?: number }) => {
    if (options.cdnAge !== undefined)
        setResponseHeader(useEvent(), 'CDN-Cache-Control', `max-age=${options.cdnAge}`)

    if (options.clientAge !== undefined)
        setResponseHeader(useEvent(), 'Cache-Control', `max-age=${options.clientAge}`)
}
