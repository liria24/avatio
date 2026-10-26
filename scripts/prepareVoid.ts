import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { parseAvatioStage } from '../config/environment.ts'
import { getVoidConfig } from '../config/void.ts'

/** Select one reviewed target pair; Void owns all publication behavior. */
export const prepareVoid = (mode: string, root = process.cwd()) => {
    const stage = parseAvatioStage(mode)
    const config = getVoidConfig(stage)
    const directory = resolve(root, 'deployment', stage)
    const lock = JSON.parse(readFileSync(resolve(directory, 'void.lock.json'), 'utf8'))
    if (
        lock.version !== 1 ||
        !isDeepStrictEqual(lock.source, config.cloudflare) ||
        !isDeepStrictEqual(lock.resolved, config.cloudflare) ||
        !isDeepStrictEqual(JSON.parse(lock.text), lock.resolved)
    )
        throw new Error(
            'Void lock must contain exactly the reviewed target and resource identities.',
        )
    for (const name of ['void.config.ts', 'void.lock.json'])
        copyFileSync(resolve(directory, name), resolve(root, name))
    writeFileSync(resolve(root, '.void-wrangler.jsonc'), lock.text)
    return config.cloudflare
}

if (import.meta.main) {
    const [stage, extra] = process.argv.slice(2)
    if (!stage || extra) throw new Error('One explicit stage is required.')
    prepareVoid(stage)
}
