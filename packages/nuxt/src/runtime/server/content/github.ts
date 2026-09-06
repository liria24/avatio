import type { Source } from 'comark-content'
import github from 'comark-content/sources/github'
import { z } from 'zod'

import type { ContentSourceMetadata } from '../../content'

export const createGithubContentSource = (options: {
    repo: string
    branch: string
    path: string
}) => {
    // Resolve lazily: a cached manifest/legal-status read needs no GitHub request.
    let resolved: Promise<{ source: Source; commit: string }> | undefined
    const resolve = () =>
        (resolved ??= (async () => {
            const response = await fetch(
                `https://api.github.com/repos/${options.repo}/commits/${encodeURIComponent(options.branch)}`,
                {
                    headers: { 'User-Agent': 'Avatio', Accept: 'application/vnd.github+json' },
                },
            )
            if (!response.ok) throw new Error(`Content revision lookup failed: ${response.status}`)
            const { sha } = z
                .object({ sha: z.string().regex(/^[a-f0-9]{40}$/) })
                .parse(await response.json())
            return { source: github({ ...options, branch: sha }), commit: sha }
        })())
    return {
        source: {
            keys: async () => (await resolve()).source.keys(),
            getItem: async (key: string) => (await resolve()).source.getItem(key),
            getItemRaw: async (key: string) => (await resolve()).source.getItemRaw(key),
        } satisfies Source,
        sourceMetadata: async (
            key: string,
        ): Promise<Omit<ContentSourceMetadata, 'sourceRevision'>> => {
            const { commit } = await resolve()
            const path = `${options.path}/${key}`
            return {
                path,
                sourceCommit: commit,
                sourceUrl: `https://github.com/${options.repo}/blob/${commit}/${path}`,
                historyUrl: `https://github.com/${options.repo}/commits/${encodeURIComponent(options.branch)}/${path}`,
            }
        },
    }
}
