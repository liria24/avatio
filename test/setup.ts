import { useServerFiles } from 'nuxt-files-sdk/runtime'

import { requireAdminSession } from '../layers/admin/server/utils/session'
import {
    createBackgroundScope,
    createRequestScope,
    getRequestScope,
    requireRequestScope,
} from '../server/utils/composition'
import { searchText } from '../server/utils/database'
import { sanitizeEmailHtml } from '../server/utils/email/sanitizeHtml'
import { serverError } from '../server/utils/error'
import { assertSessionNotBanned } from '../server/utils/eventHandler'
import {
    createCacheInvalidator,
    getCacheInvalidator,
    getFeatureFlags,
} from '../server/utils/infrastructure'
import { createPagination } from '../server/utils/pagination'
import {
    getRuntimeEnv,
    getRuntimeEnvString,
    getRuntimeStageConfig,
} from '../server/utils/runtimeEnv'
import { authAdditionalFields } from '../shared/utils/authAdditionalFields'
import { hasBetterAuthSessionCookie } from '../shared/utils/authCookie'
import * as constants from '../shared/utils/constants'
import { prefixedI18nLocales } from '../shared/utils/i18nRouting'

Object.assign(globalThis, constants, {
    assertSessionNotBanned,
    authAdditionalFields,
    createBackgroundScope,
    createCacheInvalidator,
    createPagination,
    createRequestScope,
    getCacheInvalidator,
    getFeatureFlags,
    getRequestScope,
    getRuntimeEnv,
    getRuntimeEnvString,
    getRuntimeStageConfig,
    hasBetterAuthSessionCookie,
    prefixedI18nLocales,
    requireAdminSession,
    requireRequestScope,
    sanitizeEmailHtml,
    searchText,
    serverError,
    useServerFiles,
})
