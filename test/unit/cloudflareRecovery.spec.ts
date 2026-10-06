import { rejectLegacyPublisherAfterCutover } from '../../config/alchemyDeployment'
import { cloudflareInventoryHash } from '../../config/cloudflareActivation'
import { requireCloudflareRecovery } from '../../config/cloudflareRecovery'
import { prepareCloudflareLegacyRetirement } from '../../config/cloudflareRetirement'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const sha = 'a'.repeat(40)
const point = {
    version: 1,
    accountId: inventory.accountId,
    workerName: 'avatio',
    previousVersionId: '00000000-0000-4000-8000-000000000001',
    databaseId: inventory.production.database.id,
    inventoryHash: cloudflareInventoryHash(inventory),
    appliedMigrationNames: ['20260801000000_initial/migration.sql'],
    backwardCompatibleDatabase: true,
    recoveryPointEvidence: 'https://github.com/liria24/avatio/actions/runs/1',
    rehearsalEvidence: 'https://github.com/liria24/avatio/actions/runs/2',
}
const target = {
    accountId: inventory.accountId,
    databaseId: inventory.production.database.id,
    inventory,
}
const handoff = {
    sourceSha: sha,
    applicationWorkers: ['avatio'],
    automaticPublishers: ['github-actions-native'],
    workersBuildTriggers: [],
    developmentPreview: {
        name: 'development',
        deploymentId: 'specific-development-version',
        verified: true,
    },
    populatedMigrationsVerified: true,
    freshMigrationsVerified: true,
    previewLifecycleAndSecretsVerified: true,
    productionVersionVerified: true,
    recoveryRehearsed: true,
    legacyDataResourcesRetained: true,
    evidenceUrl: 'https://github.com/liria24/avatio/actions/runs/1',
}
const state = {
    branch: 'main',
    commit: sha,
    dirty: false,
    ci: { ref: 'refs/heads/main', commit: sha },
}

describe('reviewed Worker recovery and legacy retirement', () => {
    it('never models a Worker rollback as a DB rollback or data deletion', () => {
        expect(requireCloudflareRecovery(point, target)).toMatchObject({
            databaseRollback: false,
            legacyResourceDeletion: false,
        })
    })
    it.each([
        { databaseId: inventory.development.database.id },
        { accountId: 'b'.repeat(32) },
        { backwardCompatibleDatabase: false },
        { appliedMigrationNames: [] },
        { rehearsalEvidence: 'http://invalid.test' },
        { inventoryHash: 'unreviewed' },
    ])('rejects unverified recovery scope (%j)', (patch) => {
        expect(() => requireCloudflareRecovery({ ...point, ...patch }, target)).toThrow()
    })
    it('retains the active legacy publisher until explicit native cutover', () => {
        for (const action of ['deploy', 'adopt'] as const) {
            expect(() => rejectLegacyPublisherAfterCutover(action, false)).not.toThrow()
            expect(() => rejectLegacyPublisherAfterCutover(action, true)).toThrow()
        }
        expect(() => rejectLegacyPublisherAfterCutover('check', true)).not.toThrow()
    })
    it('prepares repository cleanup while reserving the README for the user and retaining data', () => {
        expect(prepareCloudflareLegacyRetirement(handoff, state)).toMatchObject({
            userMaintainedDocument: 'README.md',
            dataResourceDeletion: false,
            workerDeletion: false,
            executionEnabled: false,
        })
    })
    it.each([
        { applicationWorkers: ['avatio', 'avatio-development'] },
        { automaticPublishers: ['github-actions-native', 'workers-builds'] },
        { workersBuildTriggers: ['legacy'] },
        { populatedMigrationsVerified: false },
        { previewLifecycleAndSecretsVerified: false },
        { recoveryRehearsed: false },
        { legacyDataResourcesRetained: false },
        { sourceSha: 'b'.repeat(40) },
    ])('refuses retirement with an incomplete actual handoff (%j)', (patch) => {
        expect(() => prepareCloudflareLegacyRetirement({ ...handoff, ...patch }, state)).toThrow()
    })
    it('refuses a feature checkout even with complete claimed handoff observations', () => {
        expect(() =>
            prepareCloudflareLegacyRetirement(handoff, { ...state, branch: 'feature' }),
        ).toThrow()
    })
})
