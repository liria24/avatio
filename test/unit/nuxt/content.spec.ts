import { join } from 'node:path'

import { loadContentPages } from '@avatio/nuxt/build/content'
import { resolveContentPage } from '@avatio/nuxt/runtime/content'

describe('Avatio content loader', () => {
    it('loads translated pages and preserves intentional fallback', async () => {
        const pages = await loadContentPages(join(process.cwd(), 'content'), ['ja', 'en'])

        expect(pages['ja:faq']?.frontmatter.title).toBe('FAQ')
        expect(pages['en:faq']?.frontmatter.description).toContain('Frequently asked')
        expect(pages['en:terms']).toBeUndefined()

        const fallback = resolveContentPage(pages, 'en', 'terms', 'ja')
        expect(fallback).toMatchObject({ locale: 'ja', requestedLocale: 'en', isFallback: true })
        expect(fallback?.frontmatter.updatedAt).toBe('2026-03-10')
        expect(fallback?.frontmatter.commitLogPath).toBe('content/ja/terms.md')
    })

    it('preserves schema and TOC metadata', async () => {
        const pages = await loadContentPages(join(process.cwd(), 'content'), ['ja', 'en'])
        const faq = pages['ja:faq']

        expect(faq?.frontmatter.schemaOrg).toMatchObject({ type: 'FaqPage' })
        expect(faq?.toc.some((link) => link.text === 'Avatioとは')).toBe(true)
    })
})
