import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseChangelogTranslation } from '../../../server/utils/changelogTranslation'
import sanitizeObject from '../../../server/utils/sanitizeObject'

beforeEach(() => {
    vi.stubGlobal('sanitizeObject', sanitizeObject)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('parseChangelogTranslation', () => {
    it('sanitizes translated changelog content before persistence', () => {
        expect(
            parseChangelogTranslation(
                JSON.stringify({
                    title: '<script>alert("xss")</script>Safe title',
                    markdown: '<p>Safe</p><script>alert("xss")</script>',
                }),
            ),
        ).toEqual({
            title: 'Safe title',
            markdown: '<p>Safe</p>',
        })
    })

    it('rejects malformed translation output', () => {
        expect(() => parseChangelogTranslation('{"title":"Missing markdown"}')).toThrow()
    })
})
