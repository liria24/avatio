export type CachedUserSettings = {
    updatedAt: Date | string | null
    showPrivateSetups: boolean
    showNSFW: boolean
}

type UserSettingsCache = {
    getItem: <T>(key: string) => Promise<T | null>
    setItem: (key: string, value: CachedUserSettings, options: { ttl: number }) => Promise<void>
}

export const getUserSettingsCacheKey = (userId: string) =>
    `user-settings:${encodeURIComponent(userId)}`

export const defaultUserSettings = {
    updatedAt: null,
    showPrivateSetups: true,
    showNSFW: false,
} satisfies CachedUserSettings

export const normalizeCachedUserSettings = (settings: CachedUserSettings) =>
    ({
        ...settings,
        updatedAt: settings.updatedAt ? new Date(settings.updatedAt) : null,
    }) satisfies CachedUserSettings

export const getUserSettingsForSession = async (
    cache: UserSettingsCache,
    userId: string,
    ttl: number,
    loadFromDatabase: () => Promise<CachedUserSettings | undefined>,
) => {
    const key = getUserSettingsCacheKey(userId)
    const cachedSettings = await cache.getItem<CachedUserSettings>(key)

    if (cachedSettings !== null) return normalizeCachedUserSettings(cachedSettings)

    const settings = normalizeCachedUserSettings((await loadFromDatabase()) ?? defaultUserSettings)
    await cache.setItem(key, settings, { ttl })
    return settings
}
