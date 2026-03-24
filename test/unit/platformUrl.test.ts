import { describe, expect, it } from 'vitest'

import type { Platform } from '../../shared/types/database'
import { computeItemUrl, computeShopUrl } from '../../shared/utils/platformUrl'

describe('computeItemUrl', () => {
    it.each<[string, string, Platform, string | undefined]>([
        ['Booth item URL', '12345', 'booth', 'https://booth.pm/ja/items/12345'],
        ['GitHub item URL', 'user/repo', 'github', 'https://github.com/user/repo'],
        ['unsupported platform', '12345', 'unknown' as Platform, undefined],
    ])('%s', (_label, id, platform, expected) => {
        expect(computeItemUrl(id, platform)).toBe(expected)
    })
})

describe('computeShopUrl', () => {
    it.each<[string, string | undefined, Platform | undefined, string | undefined]>([
        ['Booth shop URL', 'myshop', 'booth', 'https://myshop.booth.pm/'],
        ['GitHub shop URL', 'someuser', 'github', 'https://github.com/someuser'],
        ['shopId is undefined', undefined, 'booth', undefined],
        ['platform is undefined', 'myshop', undefined, undefined],
        ['unsupported platform', 'myshop', 'unknown' as Platform, undefined],
    ])('%s', (_label, shopId, platform, expected) => {
        expect(computeShopUrl(shopId, platform)).toBe(expected)
    })
})
