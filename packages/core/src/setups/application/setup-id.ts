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
