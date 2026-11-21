import { createError } from '@nuxt/nitro-server/h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import sanitizeObject from '../../../server/utils/sanitizeObject'
import { validateBody } from '../../../server/utils/validateRequest'
import { setupDraftsUpdateSchema, setupsInsertSchema } from '../../../shared/types/database'
import { draftContent } from '../../helpers/seeds'

let body: unknown
beforeEach(() => {
    Object.entries({
        sanitizeObject,
        createError,
        useEvent: () => ({}),
        logger: () => ({ error: vi.fn() }),
        readValidatedBody: (_event: unknown, validate: (value: unknown) => unknown) =>
            validate(body),
    }).forEach(([name, value]) => vi.stubGlobal(name, value))
})
afterEach(() => vi.unstubAllGlobals())

describe('raw text request validation', () => {
    it.each([
        'A & B',
        'A &amp; B',
        '<script>alert(1)</script>',
        'a+b/#&日本語',
        'https://example.test/?a=1&b=2',
    ])('preserves %s through repeated Setup and draft validation', async (text) => {
        body = {
            name: text,
            description: text,
            items: [{ itemId: 'item', note: text, shapekeys: [{ name: text, value: 0.5 }] }],
        }
        const setup = await validateBody(setupsInsertSchema)
        body = setup
        expect(await validateBody(setupsInsertSchema)).toEqual(setup)
        expect(setup.name).toBe(text)
        expect(setup.description).toBe(text)
        expect(setup.items[0]!.note).toBe(text)
        expect(setup.items[0]!.shapekeys![0]!.name).toBe(text)
        body = {
            expectedRevision: 0,
            setupId: null,
            content: { ...draftContent(text), description: text },
        }
        const draft = await validateBody(setupDraftsUpdateSchema)
        body = draft
        expect(await validateBody(setupDraftsUpdateSchema)).toEqual(draft)
        expect(draft.content.name).toBe(text)
        expect(draft.content.description).toBe(text)
    })
    it('applies schema bounds to the raw string instead of a stripped or expanded representation', async () => {
        body = { name: '&'.repeat(64), items: [{ itemId: 'item' }] }
        expect((await validateBody(setupsInsertSchema)).name).toBe('&'.repeat(64))
        body = { name: '<script>' + 'x'.repeat(65) + '</script>', items: [{ itemId: 'item' }] }
        await expect(validateBody(setupsInsertSchema)).rejects.toMatchObject({ statusCode: 400 })
    })
    it('retains recursive unsafe-key filtering while preserving plain text', async () => {
        body = JSON.parse(
            '{"__proto__":{"polluted":true},"constructor":{},"prototype":{},"nested":{"constructor":{},"text":"A & B"},"array":[{"__proto__":{},"text":"<b>literal</b>"}]}',
        )
        expect(await validateBody(z.unknown())).toEqual({
            nested: { text: 'A & B' },
            array: [{ text: '<b>literal</b>' }],
        })
        expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
    })
    it('preserves explicit HTML sanitization', async () => {
        body = { html: '<p onclick="alert(1)">A & B</p><script>alert(1)</script>' }
        expect(await validateBody(z.object({ html: z.string() }), { sanitize: true })).toEqual({
            html: '<p>A &amp; B</p>',
        })
    })
})
