import type { Source } from 'comark-content'
import { z } from 'zod'

import type { ContentSourceMetadata } from '../../content'

const resolveBranchCommit = async (repo: string, branch: string) => {
    const response = await fetch(
        `https://github.com/${repo}.git/info/refs?service=git-upload-pack`,
        {
            headers: { 'User-Agent': 'Avatio' },
            cache: 'no-store',
        },
    )
    if (!response.ok) throw new Error(`Content revision lookup failed: ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const decoder = new TextDecoder()
    // Git smart HTTP advertises current refs without the shared-IP REST API quota.
    for (let offset = 0; offset < bytes.length;) {
        const prefix = decoder.decode(bytes.subarray(offset, offset + 4))
        if (!/^[a-f0-9]{4}$/i.test(prefix)) throw new Error('Invalid Git reference packet.')
        const length = Number.parseInt(prefix, 16)
        if (length === 0) {
            offset += 4
            continue
        }
        if (length < 4 || offset + length > bytes.length)
            throw new Error('Invalid Git reference packet length.')
        const packet = decoder.decode(bytes.subarray(offset + 4, offset + length))
        const reference = /^([a-f0-9]{40}) ([^\0\n]+)(?:\0[^\n]*)?\n?$/.exec(packet)
        if (reference?.[1] && reference[2] === `refs/heads/${branch}`) return reference[1]
        offset += length
    }
    throw new Error('Content branch was not advertised.')
}

export const createGithubContentSource = (options: {
    repo: string
    branch: string
    path: string
}) => {
    // Resolve lazily: a cached manifest/legal-status read needs no GitHub request.
    let resolved: Promise<{ keys: string[]; commit: string }> | undefined
    const resolve = () =>
        (resolved ??= (async () => {
            const commit = await resolveBranchCommit(options.repo, options.branch)
            const response = await fetch(`https://ungh.cc/repos/${options.repo}/files/${commit}`)
            if (!response.ok) throw new Error(`Content tree lookup failed: ${response.status}`)
            const { files } = z
                .object({ files: z.array(z.object({ path: z.string().min(1) })) })
                .parse(await response.json())
            const prefix = `${options.path}/`
            const keys = files
                .filter(({ path }) => path.startsWith(prefix))
                .map(({ path }) => path.slice(prefix.length))
            if (
                keys.some((key) =>
                    key.split('/').some((part) => !part || part === '.' || part === '..'),
                )
            )
                throw new Error('Invalid content source path.')
            return { keys, commit }
        })())
    const read = async (key: string) => {
        const { keys, commit } = await resolve()
        if (!keys.includes(key)) throw new Error('Unknown content source path.')
        const path = `${options.path}/${key}`.split('/').map(encodeURIComponent).join('/')
        const response = await fetch(
            `https://raw.githubusercontent.com/${options.repo}/${commit}/${path}`,
        )
        if (!response.ok) throw new Error(`Content file lookup failed: ${response.status}`)
        return response
    }
    return {
        source: {
            keys: async () => (await resolve()).keys,
            getItem: async (key: string) => (await read(key)).text(),
            getItemRaw: async (key: string) =>
                new Uint8Array(await (await read(key)).arrayBuffer()),
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
