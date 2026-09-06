import { D1PublisherRepository } from '@avatio/cloudflare'
import {
    PublisherVerificationError,
    PublisherVerificationProviderRegistry,
} from '@avatio/core/publishers'
import { BoothPublisherVerificationProvider } from '@avatio/nuxt/runtime/server/publishers/providers'

export const getPublisherRepository = () => new D1PublisherRepository(getDatabaseBinding())

export const getPublisherVerificationProviderRegistry = () => {
    const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL')
    if (!proxyBaseUrl) throw new Error('Missing required BOOTH_PROXY_URL runtime secret.')

    return new PublisherVerificationProviderRegistry([
        new BoothPublisherVerificationProvider({ proxyBaseUrl, http: providerHttpClient }),
    ])
}

export const throwPublisherVerificationHttpError = (error: unknown): never => {
    if (!(error instanceof PublisherVerificationError)) throw error

    if (error.code === 'challenge-not-found') throw serverError.notFound()
    if (error.code === 'challenge-expired')
        throw createError({ statusCode: 410, statusMessage: 'Gone' })
    if (error.code === 'challenge-consumed')
        throw createError({ statusCode: 409, statusMessage: 'Conflict' })
    throw serverError.badRequest({ responseMessage: error.message })
}
