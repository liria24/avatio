import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

import { parseMarkdown } from 'comark'
import { z } from 'zod'

import { buildContentToc, type AvatioSourceContentPage } from '../runtime/content'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const contentFrontmatterSchema = z
    .object({
        title: z.string().min(1),
        description: z.string().optional(),
        image: z.string().optional(),
        updatedAt: isoDateSchema.optional(),
        effectiveDate: isoDateSchema.optional(),
        commitLogPath: z.string().optional(),
        schemaOrg: z
            .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
            .optional(),
        sitemap: z.record(z.string(), z.unknown()).optional(),
        robots: z.union([z.string(), z.boolean()]).optional(),
        head: z.record(z.string(), z.unknown()).optional(),
        seo: z.record(z.string(), z.unknown()).optional(),
    })
    .catchall(z.unknown())

const markdownFiles = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = await Promise.all(
        entries.map(async (entry) => {
            const path = resolve(directory, entry.name)
            if (entry.isDirectory()) return markdownFiles(path)
            return entry.isFile() && extname(entry.name) === '.md' ? [path] : []
        }),
    )
    return files.flat()
}

export const loadContentPages = async (
    contentDirectory: string,
    locales: readonly string[],
): Promise<Record<string, AvatioSourceContentPage>> => {
    const pages: Record<string, AvatioSourceContentPage> = {}

    for (const file of await markdownFiles(contentDirectory)) {
        const relativePath = relative(contentDirectory, file).split(sep).join('/')
        const [locale, ...slugParts] = relativePath.replace(/\.md$/, '').split('/')
        if (!locale || !locales.includes(locale) || slugParts.length === 0) continue
        const slug = slugParts.join('/')
        const document = await parseMarkdown(await readFile(file, 'utf8'))
        const parsedFrontmatter = contentFrontmatterSchema.safeParse(document.frontmatter)
        if (!parsedFrontmatter.success) {
            throw new Error(
                `Invalid content frontmatter in ${relativePath}: ${z.prettifyError(parsedFrontmatter.error)}`,
            )
        }

        const key = `${locale}:${slug}`
        if (pages[key]) throw new Error(`Duplicate content page: ${key}`)
        const typedDocument: AvatioSourceContentPage['document'] = {
            ...document,
            frontmatter: parsedFrontmatter.data,
        }
        pages[key] = {
            locale,
            slug,
            frontmatter: parsedFrontmatter.data,
            document: typedDocument,
            toc: buildContentToc(typedDocument),
        }
    }

    return pages
}
