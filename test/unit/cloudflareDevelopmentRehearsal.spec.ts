import { createHash } from 'node:crypto'

import {
    cloudflareInventoryHash,
    requireCloudflareActivation,
} from '../../config/cloudflareActivation'
import {
    confirmCloudflareDevelopmentLedgerUnchanged,
    requireCloudflareDevelopmentLedger,
    requireCloudflareDevelopmentRehearsal,
} from '../../scripts/cloudflareDevelopmentRehearsal'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const now = Date.parse('2026-10-07T00:00:00.000Z')
const files = [
    {
        name: '20260101000000_first/migration.sql',
        sql: 'CREATE TABLE example (id INTEGER PRIMARY KEY);',
    },
    {
        name: '20260102000000_second/migration.sql',
        sql: 'ALTER TABLE example ADD COLUMN value TEXT;',
    },
].map((file) => ({ ...file, hash: createHash('sha256').update(file.sql).digest('hex') }))
const migrationNames = files.map((file) => file.name)
const expected = () => ({
    action: 'rehearse',
    mode: 'development',
    eventName: 'workflow_dispatch',
    sourceRef: 'refs/heads/development',
    trustedRef: 'refs/heads/development',
    sourceSha: sha,
    latestSourceSha: sha,
    trustedCodeSha: sha,
    quality: { runId: '1234', sourceSha: sha, succeeded: true },
    inventory: structuredClone(inventory),
})
const approval = () => ({
    version: 1,
    repository: 'liria24/avatio',
    action: 'rehearse',
    mode: 'development',
    sourceSha: sha,
    trustedCodeSha: sha,
    qualityRunId: '1234',
    inventoryHash: cloudflareInventoryHash(inventory),
    expiresAt: new Date(now + 3_600_000).toISOString(),
    buildArtifactPublicationApproved: true,
    previewSecretTransferApproved: true,
    incidentalNonProductionRuntimeWritesApproved: true,
    publicInitialPreviewApproved: true,
})
const ledgerExpected = () => ({
    inventory: structuredClone(inventory),
    trustedCodeSha: sha,
    filesSha: sha,
    files: structuredClone(files),
    migrationNames: [...migrationNames],
})
const snapshot = () => ({
    complete: true,
    accountId: inventory.accountId,
    databaseId: inventory.development.database.id,
    schema: [
        {
            type: 'table',
            name: '__alchemy_migrations',
            tableName: '__alchemy_migrations',
            sql: 'CREATE TABLE __alchemy_migrations (id INTEGER PRIMARY KEY, name TEXT, hash TEXT, applied_at TEXT)',
        },
        {
            type: 'table',
            name: 'example',
            tableName: 'example',
            sql: 'CREATE TABLE example (id INTEGER PRIMARY KEY, value TEXT)',
        },
    ],
    alchemy: files.map((file, index) => ({
        id: index + 1,
        name: index === 0 ? file.name : file.name.replace('/migration.sql', ''),
        hash: file.hash,
        appliedAt: '2026-01-02 00:00:00',
    })),
})

describe('manual development runtime rehearsal approval', () => {
    it('binds a separate receipt to current successful development quality and the reviewed inventory', () => {
        expect(requireCloudflareDevelopmentRehearsal(approval(), expected(), now)).toEqual(
            approval(),
        )
    })
    it.each(['push', 'workflow_run', 'pull_request_target'])('rejects event %s', (eventName) => {
        expect(() =>
            requireCloudflareDevelopmentRehearsal(approval(), { ...expected(), eventName }, now),
        ).toThrow()
    })
    it.each(['production', 'pr-354', 'Development', ''])('rejects mode %s', (mode) => {
        expect(() =>
            requireCloudflareDevelopmentRehearsal(approval(), { ...expected(), mode }, now),
        ).toThrow()
        expect(() =>
            requireCloudflareDevelopmentRehearsal({ ...approval(), mode }, expected(), now),
        ).toThrow()
    })
    it.each(['deploy', 'bootstrap', 'cleanup', 'rollback'])('rejects action %s', (action) => {
        expect(() =>
            requireCloudflareDevelopmentRehearsal(approval(), { ...expected(), action }, now),
        ).toThrow()
        expect(() =>
            requireCloudflareDevelopmentRehearsal({ ...approval(), action }, expected(), now),
        ).toThrow()
    })
    it.each(['sourceSha', 'latestSourceSha', 'trustedCodeSha'] as const)(
        'rejects stale or different %s',
        (key) => {
            expect(() =>
                requireCloudflareDevelopmentRehearsal(
                    approval(),
                    { ...expected(), [key]: otherSha },
                    now,
                ),
            ).toThrow()
        },
    )
    it.each(['sourceRef', 'trustedRef'] as const)('rejects non-development %s', (key) => {
        expect(() =>
            requireCloudflareDevelopmentRehearsal(
                approval(),
                { ...expected(), [key]: 'refs/heads/main' },
                now,
            ),
        ).toThrow()
    })
    it.each([
        { runId: '1235' },
        { runId: '0' },
        { runId: '-1' },
        { runId: '1e3' },
        { sourceSha: otherSha },
        { succeeded: false },
    ])('rejects stale, failed or invalid quality %j', (change) => {
        const context = expected()
        Object.assign(context.quality, change)
        expect(() => requireCloudflareDevelopmentRehearsal(approval(), context, now)).toThrow()
    })
    it('rejects a changed receipt commit or inventory, malformed receipt and unreviewed extra flags', () => {
        for (const change of [
            { sourceSha: otherSha },
            { trustedCodeSha: otherSha },
            { sourceSha: 'main' },
            { repository: 'fork/avatio' },
            { inventoryHash: 'b'.repeat(64) },
            { enabled: true },
            { skipMigrations: true },
            { productionCutoverApproved: true },
        ])
            expect(() =>
                requireCloudflareDevelopmentRehearsal(
                    { ...approval(), ...change },
                    expected(),
                    now,
                ),
            ).toThrow()
        const context = expected()
        context.inventory.development.siteUrl = 'https://development.other.example.test'
        expect(() => requireCloudflareDevelopmentRehearsal(approval(), context, now)).toThrow()
        expect(() => requireCloudflareDevelopmentRehearsal(null, expected(), now)).toThrow()
    })
    it.each([
        'buildArtifactPublicationApproved',
        'previewSecretTransferApproved',
        'incidentalNonProductionRuntimeWritesApproved',
        'publicInitialPreviewApproved',
    ] as const)('requires explicit %s', (key) => {
        for (const value of [false, undefined, 'true']) {
            expect(() =>
                requireCloudflareDevelopmentRehearsal(
                    { ...approval(), [key]: value },
                    expected(),
                    now,
                ),
            ).toThrow()
        }
    })
    it('allows at most 24 hours and rejects an expired receipt or invalid clock', () => {
        for (const offset of [-1, 0, 86_400_001]) {
            expect(() =>
                requireCloudflareDevelopmentRehearsal(
                    { ...approval(), expiresAt: new Date(now + offset).toISOString() },
                    expected(),
                    now,
                ),
            ).toThrow()
        }
        expect(() =>
            requireCloudflareDevelopmentRehearsal(
                { ...approval(), expiresAt: new Date(now + 86_400_000).toISOString() },
                expected(),
                now,
            ),
        ).not.toThrow()
        expect(() =>
            requireCloudflareDevelopmentRehearsal(approval(), expected(), Number.NaN),
        ).toThrow()
    })
    it('cannot activate the ordinary publisher even when its global flag is enabled', () => {
        for (const enabled of [false, true]) {
            expect(() =>
                requireCloudflareActivation(
                    approval(),
                    {
                        action: 'deploy',
                        mode: 'development',
                        sourceSha: sha,
                        trustedCodeSha: sha,
                        inventory,
                        enabled,
                    },
                    now,
                ),
            ).toThrow()
        }
    })
})

describe('development Alchemy runtime rehearsal snapshot', () => {
    it.each([null, '', '   '])('rejects a missing table definition %j', (sql) => {
        const value = snapshot()
        const schema = value.schema.map((row, index) => (index === 0 ? { ...row, sql } : row))
        expect(() =>
            requireCloudflareDevelopmentLedger({ ...value, schema }, ledgerExpected()),
        ).toThrow()
    })
    it('requires all exact trusted SQL hashes already applied and preserves metadata without writing', () => {
        const before = snapshot()
        const original = structuredClone(before)
        expect(requireCloudflareDevelopmentLedger(before, ledgerExpected()).alchemy).toEqual(
            before.alchemy,
        )
        expect(before).toEqual(original)
        expect(
            confirmCloudflareDevelopmentLedgerUnchanged(
                before,
                structuredClone(before),
                ledgerExpected(),
            ),
        ).toEqual({
            ledgerUnchanged: true,
            migrationCompatibilityVerified: false,
        })
    })
    it('compares full selected schema and ledger independent of response ordering', () => {
        const before = snapshot()
        const after = structuredClone(before)
        after.schema.reverse()
        after.alchemy.reverse()
        expect(() =>
            confirmCloudflareDevelopmentLedgerUnchanged(before, after, ledgerExpected()),
        ).not.toThrow()
    })
    it('rejects production, shared Preview and other account identities', () => {
        for (const databaseId of [
            inventory.production.database.id,
            inventory.sharedPreviewStorage.database.id,
        ]) {
            expect(() =>
                requireCloudflareDevelopmentLedger({ ...snapshot(), databaseId }, ledgerExpected()),
            ).toThrow()
        }
        expect(() =>
            requireCloudflareDevelopmentLedger(
                { ...snapshot(), accountId: 'f'.repeat(32) },
                ledgerExpected(),
            ),
        ).toThrow()
    })
    it('never treats failed, partial, absent or empty history reads as a valid snapshot', () => {
        for (const input of [
            null,
            {},
            { ...snapshot(), complete: false },
            { ...snapshot(), schema: [] },
            { ...snapshot(), alchemy: [] },
        ]) {
            expect(() => requireCloudflareDevelopmentLedger(input, ledgerExpected())).toThrow()
        }
    })
    it('rejects d1_migrations even when it is empty, differently cased, or a view', () => {
        for (const [name, type] of [
            ['d1_migrations', 'table'],
            ['D1_MIGRATIONS', 'table'],
            ['d1_migrations', 'view'],
        ]) {
            const input = snapshot()
            input.schema.push({ name: name!, tableName: name!, type: type!, sql: '' })
            expect(() => requireCloudflareDevelopmentLedger(input, ledgerExpected())).toThrow()
        }
    })
    it('rejects a missing Alchemy table, duplicate schema entries or duplicate row IDs', () => {
        const missing = snapshot()
        missing.schema.shift()
        const duplicateSchema = snapshot()
        duplicateSchema.schema.push(duplicateSchema.schema[0]!)
        const duplicateId = snapshot()
        duplicateId.alchemy[1]!.id = duplicateId.alchemy[0]!.id
        for (const input of [missing, duplicateSchema, duplicateId]) {
            expect(() => requireCloudflareDevelopmentLedger(input, ledgerExpected())).toThrow()
        }
    })
    it('rejects pending, missing, gapped, duplicate, unknown, renamed or mismatched Alchemy rows', () => {
        const full = snapshot().alchemy
        for (const alchemy of [
            full.slice(0, 1),
            full.slice(1),
            [...full, { ...full[0]!, id: 3 }],
            [{ ...full[0]!, name: 'unknown' }, full[1]!],
            [{ ...full[0]!, hash: 'f'.repeat(64) }, full[1]!],
            [{ ...full[0]!, appliedAt: '' }, full[1]!],
        ])
            expect(() =>
                requireCloudflareDevelopmentLedger({ ...snapshot(), alchemy }, ledgerExpected()),
            ).toThrow()
    })
    it('rejects truncated, changed or incorrectly attributed trusted SQL and artifact migration sets', () => {
        const changedSql = ledgerExpected()
        changedSql.files[0]!.sql += '\n-- changed'
        for (const context of [
            changedSql,
            { ...ledgerExpected(), filesSha: otherSha },
            { ...ledgerExpected(), trustedCodeSha: 'development' },
            { ...ledgerExpected(), files: files.slice(0, 1) },
            { ...ledgerExpected(), migrationNames: migrationNames.slice(0, 1) },
            { ...ledgerExpected(), migrationNames: [...migrationNames].reverse() },
            { ...ledgerExpected(), files: [] },
            { ...ledgerExpected(), files: [...files, files[0]!] },
        ])
            expect(() => requireCloudflareDevelopmentLedger(snapshot(), context)).toThrow()
    })
    it('fails closed if schema, timestamps, IDs or either ledger changes after publication', () => {
        const before = snapshot()
        const schemaChange = snapshot()
        schemaChange.schema[1]!.sql += '; CREATE INDEX new_index ON example (value)'
        const timeChange = snapshot()
        timeChange.alchemy[0]!.appliedAt = '2026-01-03 00:00:00'
        const idChange = snapshot()
        idChange.alchemy[0]!.id = 100
        const aliasChange = snapshot()
        aliasChange.alchemy[0]!.name = files[0]!.name.replace('/migration.sql', '')
        const newLedger = snapshot()
        newLedger.schema.push({
            type: 'table',
            name: 'd1_migrations',
            tableName: 'd1_migrations',
            sql: 'CREATE TABLE d1_migrations (name TEXT)',
        })
        for (const after of [schemaChange, timeChange, idChange, aliasChange, newLedger]) {
            expect(() =>
                confirmCloudflareDevelopmentLedgerUnchanged(before, after, ledgerExpected()),
            ).toThrow()
        }
    })
})
