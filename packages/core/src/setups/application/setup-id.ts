import type { SetupId } from '../domain/setup'

export interface SetupIdPolicy {
    isReserved(id: SetupId): boolean
}

export interface SetupIdExistence {
    exists(id: SetupId): Promise<boolean>
}

export interface GenerateSetupIdOptions {
    policy: SetupIdPolicy
    repository: SetupIdExistence
    generate: () => SetupId
    maxAttempts?: number
}

export const generateAvailableSetupId = async ({
    policy,
    repository,
    generate,
    maxAttempts = 128,
}: GenerateSetupIdOptions): Promise<SetupId> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = generate()
        if (!policy.isReserved(candidate) && !(await repository.exists(candidate))) return candidate
    }

    throw new Error(`Unable to generate an available Setup ID after ${maxAttempts} attempts`)
}

export const setupPath = (id: SetupId, policy: SetupIdPolicy): string =>
    policy.isReserved(id) ? `/setup/${encodeURIComponent(id)}` : `/${encodeURIComponent(id)}`

export const matchSetupPath = (
    pathname: string,
    policy: SetupIdPolicy,
    locales: readonly string[],
    staticPaths: ReadonlySet<string>,
): SetupId | null => {
    const segments = pathname.replace(/\/$/, '').split('/').slice(1)
    if (segments[0] && locales.includes(segments[0])) segments.shift()
    const path = `/${segments.join('/')}`
    if (staticPaths.has(path.toLowerCase())) return null
    const encodedId =
        segments.length === 1
            ? segments[0]
            : segments.length === 2 && segments[0] === 'setup'
              ? segments[1]
              : undefined
    if (!encodedId) return null
    let id: string
    try {
        id = decodeURIComponent(encodedId)
    } catch {
        return null
    }
    if (
        id.includes('/') ||
        id.includes('\\') ||
        Array.from(id).some((character) => character.charCodeAt(0) < 32)
    )
        return null
    if (segments.length === 2 && staticPaths.has(`/setup/${id}`.toLowerCase())) return null
    return segments.length === 1 && policy.isReserved(id) ? null : id
}
