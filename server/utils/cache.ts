export const purgeSetupCache = async (id: number) => {
    const keys = await useStorage('cache').keys(`nitro:functions:setup:${id}`)
    await Promise.all([
        useStorage('cache').del(`nitro:functions:setup:${id}.json`),
        ...keys.map((key) => useStorage('cache').del(key)),
    ])
}

export const purgeUserCache = async (id: string) => {
    await useStorage('cache').del(`nitro:functions:user:${id}.json`)
}

export const defineCacheControl = (options: { cdnAge: number; clientAge: number }) => {
    setResponseHeader(useEvent(), 'CDN-Cache-Control', `max-age=${options.cdnAge}`)
    setResponseHeader(useEvent(), 'Cache-Control', `max-age=${options.clientAge}`)
}
