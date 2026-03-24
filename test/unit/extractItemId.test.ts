import { describe, expect, it } from 'vitest'

import extractItemId from '../../shared/utils/extractItemId'

describe('extractItemId', () => {
    describe('Booth URLs', () => {
        it.each([
            ['standard URL', 'https://booth.pm/items/12345', { id: '12345', platform: 'booth' }],
            [
                'localized URL (ja)',
                'https://booth.pm/ja/items/12345',
                { id: '12345', platform: 'booth' },
            ],
            [
                'localized URL (en)',
                'https://booth.pm/en/items/67890',
                { id: '67890', platform: 'booth' },
            ],
            [
                'subdomain URL',
                'https://shop.booth.pm/items/99999',
                { id: '99999', platform: 'booth' },
            ],
            [
                'singular /items/ path',
                'https://booth.pm/items/11111',
                { id: '11111', platform: 'booth' },
            ],
            ['URL without item ID', 'https://booth.pm/', null],
            ['shop URL', 'https://myshop.booth.pm/', null],
        ])('%s', (_label, url, expected) => {
            expect(extractItemId(url)).toEqual(expected)
        })
    })

    describe('GitHub URLs', () => {
        it.each([
            [
                'owner/repo URL',
                'https://github.com/user/repo',
                { id: 'user/repo', platform: 'github' },
            ],
            [
                'URL with trailing slash',
                'https://github.com/user/repo/',
                { id: 'user/repo', platform: 'github' },
            ],
            ['profile URL (no repo)', 'https://github.com/user', null],
        ])('%s', (_label, url, expected) => {
            expect(extractItemId(url)).toEqual(expected)
        })
    })

    describe('Invalid / unsupported URLs', () => {
        it.each([
            ['unsupported platform URL', 'https://twitter.com/someone'],
            ['plain invalid string', 'not-a-url'],
            ['empty string', ''],
        ])('%s', (_label, url) => {
            expect(extractItemId(url)).toBeNull()
        })
    })
})
