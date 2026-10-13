import { createHash } from 'node:crypto'
import {
    existsSync,
    linkSync,
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    rmdirSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
    mapCloudflareMigrationHistory,
    requireIsolatedMigrationCopy,
} from '../../scripts/cloudflareMigrationHistory'

const files = [
    { name: '20260101000000_first/migration.sql', hash: 'a'.repeat(64) },
    { name: '20260102000000_second/migration.sql', hash: 'b'.repeat(64) },
    { name: '20260103000000_third/migration.sql', hash: 'c'.repeat(64) },
]
const history = files.slice(0, 2).map((file, index) => ({
    name: index === 0 ? file.name : file.name.replace('/migration.sql', ''),
    hash: file.hash,
    appliedAt: '2026-01-01 00:00:00',
}))

describe('Cloudflare migration-history conversion', () => {
    it('accepts only an unchanged standalone private copy, rejecting outside files, sidecars and hardlinks', () => {
        const workspace = mkdtempSync(join(tmpdir(), 'avatio-ledger-unit-'))
        const root = join(workspace, '.cloudflare', 'verification', 'copies')
        const target = join(root, 'copy.sqlite')
        const outside = join(workspace, 'local.sqlite')
        const linked = join(root, 'linked.sqlite')
        const sidecar = `${target}-wal`
        const data = 'synthetic-copy-bytes'
        const hash = createHash('sha256').update(data).digest('hex')
        mkdirSync(root, { recursive: true })
        writeFileSync(target, data)
        writeFileSync(outside, data)
        try {
            expect(requireIsolatedMigrationCopy(target, hash, workspace)).toBe(realpathSync(target))
            expect(() => requireIsolatedMigrationCopy(outside, hash, workspace)).toThrow()
            expect(() => requireIsolatedMigrationCopy(target, 'a'.repeat(64), workspace)).toThrow()
            writeFileSync(sidecar, 'synthetic-wal')
            expect(() => requireIsolatedMigrationCopy(target, hash, workspace)).toThrow()
            rmSync(sidecar)
            linkSync(outside, linked)
            expect(() => requireIsolatedMigrationCopy(linked, hash, workspace)).toThrow()
        } finally {
            for (const file of [sidecar, linked, target, outside])
                if (existsSync(file)) rmSync(file)
            for (const directory of [
                root,
                join(workspace, '.cloudflare', 'verification'),
                join(workspace, '.cloudflare'),
                workspace,
            ])
                rmdirSync(directory)
        }
    })
    it('maps both Alchemy aliases while retaining existing cf rows and pending files', () => {
        expect(mapCloudflareMigrationHistory(files, history, [{ name: files[0]!.name }])).toEqual({
            imports: [{ ...history[1], name: files[1]!.name }],
            pending: [files[2]!.name],
        })
    })
    it('leaves every file pending for a clean database', () => {
        expect(mapCloudflareMigrationHistory(files, [], [])).toEqual({
            imports: [],
            pending: files.map((file) => file.name),
        })
    })
    it.each(
        [
            [{ ...history[0]!, hash: 'd'.repeat(64) }],
            [{ ...history[0]!, name: 'unknown' }],
            [history[1]!],
            [history[0]!, history[0]!],
            [{ ...history[0]!, appliedAt: '' }],
        ].map((rows) => ({ rows })),
    )('refuses unsafe Alchemy history before selecting any imports', ({ rows }) => {
        expect(() => mapCloudflareMigrationHistory(files, rows, [])).toThrow()
    })
    it('rejects conflicting cf history and invalid/duplicate file identities', () => {
        expect(() =>
            mapCloudflareMigrationHistory(files, history, [{ name: files[2]!.name }]),
        ).toThrow()
        expect(() =>
            mapCloudflareMigrationHistory(files, history, [
                { name: files[0]!.name },
                { name: files[0]!.name },
            ]),
        ).toThrow()
        expect(() => mapCloudflareMigrationHistory([...files, files[0]!], history, [])).toThrow()
        expect(() =>
            mapCloudflareMigrationHistory(
                [{ name: '../migration.sql', hash: 'a'.repeat(64) }],
                [],
                [],
            ),
        ).toThrow()
    })
})
