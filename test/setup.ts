// oxlint-disable typescript/no-explicit-any
import { $fetch } from 'ofetch'

import * as constants from '../shared/utils/constants'

Object.assign(globalThis, constants)

// Polyfill Nuxt/Nitro auto-imported $fetch
;(globalThis as any).$fetch = $fetch

// Polyfill Nitro defineCachedFunction — bypasses caching in tests
;(globalThis as any).defineCachedFunction = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    _opts?: any,
): T => fn
