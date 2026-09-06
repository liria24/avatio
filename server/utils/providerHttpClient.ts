import type { ProviderHttpClient } from '@avatio/nuxt/runtime/server/catalog/providers'

export const providerHttpClient: ProviderHttpClient = {
    async get<T>(url: string) {
        const response = await $fetch.raw<T | null>(url, { ignoreResponseError: true })
        return {
            status: response.status,
            ok: response.ok,
            data: response._data ?? null,
        }
    },
}
