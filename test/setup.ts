import { useServerFiles } from 'nuxt-files-sdk/runtime'

import { requireAdminSession } from '../server/utils/adminSession'
import { serverError } from '../server/utils/error'
import { assertSessionNotBanned } from '../server/utils/eventHandler'
import {
    createCacheInvalidator,
    getCacheInvalidator,
    getFeatureFlags,
} from '../server/utils/infrastructure'
import { createPagination } from '../server/utils/pagination'
import { getRuntimeEnv, getRuntimeEnvString } from '../server/utils/runtimeEnv'
import { sanitizeEmailHtml } from '../server/utils/sanitizeEmailHtml'
import { authAdditionalFields } from '../shared/utils/authAdditionalFields'
import { hasBetterAuthSessionCookie } from '../shared/utils/authCookie'
import * as constants from '../shared/utils/constants'
import { prefixedI18nLocales } from '../shared/utils/i18nRouting'

Object.assign(globalThis, constants, {
    assertSessionNotBanned,
    authAdditionalFields,
    createCacheInvalidator,
    createPagination,
    getCacheInvalidator,
    getFeatureFlags,
    getRuntimeEnv,
    getRuntimeEnvString,
    hasBetterAuthSessionCookie,
    prefixedI18nLocales,
    requireAdminSession,
    sanitizeEmailHtml,
    serverError,
    useServerFiles,
})
