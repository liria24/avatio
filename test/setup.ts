import { useServerFiles } from 'nuxt-files-sdk/runtime'
// oxlint-disable typescript/no-explicit-any
import { $fetch } from 'ofetch'

import { serverError } from '../server/utils/error'
import {
    createCacheInvalidator,
    getCacheInvalidator,
    getFeatureFlags,
} from '../server/utils/infrastructure'
import { getRuntimeEnv, getRuntimeEnvString } from '../server/utils/runtimeEnv'
import { sanitizeEmailHtml } from '../server/utils/sanitizeEmailHtml'
import { authAdditionalFields } from '../shared/utils/authAdditionalFields'
import { hasBetterAuthSessionCookie } from '../shared/utils/authCookie'
import * as constants from '../shared/utils/constants'
import { prefixedI18nLocales } from '../shared/utils/i18nRouting'

Object.assign(globalThis, constants, {
    authAdditionalFields,
    createCacheInvalidator,
    getCacheInvalidator,
    getFeatureFlags,
    getRuntimeEnv,
    getRuntimeEnvString,
    hasBetterAuthSessionCookie,
    prefixedI18nLocales,
    sanitizeEmailHtml,
    serverError,
    useServerFiles,
})

// Polyfill Nuxt/Nitro auto-imported $fetch
;(globalThis as any).$fetch = $fetch

// Polyfill Nitro defineCachedFunction — bypasses caching in tests
;(globalThis as any).defineCachedFunction = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    _opts?: any,
): T => fn
