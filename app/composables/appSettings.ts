import type { RemovableRef } from '@vueuse/core'

export interface AppSettings {
    cookiesConsent: boolean
    ownerWarningBannerDismissed?: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
    cookiesConsent: false,
    ownerWarningBannerDismissed: false,
}

const STORAGE_KEY = 'avatio-settings'

let settingsRef: RemovableRef<AppSettings> | null = null

export const useAppSettings = () => {
    if (!settingsRef)
        settingsRef = useLocalStorage<AppSettings>(STORAGE_KEY, DEFAULT_SETTINGS, {
            mergeDefaults: true,
        })

    return {
        settings: settingsRef,
    }
}

export const useCookiesConsent = () => {
    const { settings } = useAppSettings()

    const giveConsent = () => {
        settings.value.cookiesConsent = true
    }

    return {
        consented: computed(() => settings.value.cookiesConsent),
        giveConsent,
    }
}

export const useOwnerWarningBanner = () => {
    const { settings } = useAppSettings()

    const dismissBanner = () => {
        settings.value.ownerWarningBannerDismissed = true
    }

    return {
        dismissed: computed(() => settings.value.ownerWarningBannerDismissed),
        dismissBanner,
    }
}
