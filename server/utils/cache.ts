export const purgeSetupCache = async (id: number) => {
    const keys = await useStorage('cache').keys(
        `cache:nitro:functions:setup:${id}`
    )
    await Promise.all([
        useStorage('cache').del(`nitro:functions:setup:${id}.json`),
        ...keys.map((key) =>
            useStorage('cache').del(key.replace('cache:', ''))
        ),
    ])
}

export const purgeUserCache = async (id: string) => {
    console.log(await useStorage('cache').keys(`nitro:functions`))
    await useStorage('cache').del(`nitro:functions:user:${id}.json`)
}
