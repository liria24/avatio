import type { SetupId } from '../domain/setup'

export interface SetupRepository {
    exists(id: SetupId): Promise<boolean>
}
