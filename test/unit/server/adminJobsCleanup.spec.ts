import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface StorageObject {
    key: string
    lastModified: number
}

interface CleanupDbRows {
    setupImages?: { objectKey: string }[]
    setupDraftImages?: { objectKey: string }[]
    users?: { image: string | null }[]
}

type RuntimeGlobal = typeof globalThis & {
    __env__?: Partial<Record<string, string>>
}

const publicBaseUrl = 'https://cdn.example.com'
const discordEndpoint = 'https://discord.example.com'
const oldDate = Date.parse('2026-06-05T00:00:00.000Z')
const recentDate = Date.parse('2026-06-07T10:00:00.000Z')
const runtimeGlobal = globalThis as RuntimeGlobal

const log = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}

const storage = {
    copy: vi.fn(),
    delete: vi.fn(),
    listAll: vi.fn(),
}

const discordFetch = vi.fn()

const makeAsyncIterable = (items: StorageObject[]) =>
    (async function* () {
        for (const item of items) yield item
    })()

const arrange = ({
    rows = {},
    setupObjects = [],
    avatarObjects = [],
}: {
    rows?: CleanupDbRows
    setupObjects?: StorageObject[]
    avatarObjects?: StorageObject[]
}) => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('$fetch', discordFetch)
    vi.stubGlobal(
        'getRuntimeEnvString',
        (name: string) => runtimeGlobal.__env__?.[name] ?? process.env[name],
    )
    vi.stubGlobal('useRuntimeConfig', () => ({ cloudflare: {} }))
    vi.stubGlobal('storage', storage)
    vi.stubGlobal('useDB', () => ({
        query: {
            setupImages: {
                findMany: vi.fn().mockResolvedValue(rows.setupImages ?? []),
            },
            setupDraftImages: {
                findMany: vi.fn().mockResolvedValue(rows.setupDraftImages ?? []),
            },
            users: {
                findMany: vi.fn().mockResolvedValue(rows.users ?? []),
            },
        },
    }))

    storage.listAll.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'setup/') return makeAsyncIterable(setupObjects)
        if (prefix === 'avatar/') return makeAsyncIterable(avatarObjects)
        return makeAsyncIterable([])
    })
}

const runCleanupJob = async (dryRun = false) => {
    const module = await import('../../../server/utils/adminJobs')
    return await module.runCleanupJob({ dryRun })
}

describe('runCleanupJob', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'))
        process.env.R2_PUBLIC_BASE_URL = publicBaseUrl
        process.env.LIRIA_DISCORD_ENDPOINT = `${discordEndpoint}/`
        process.env.LIRIA_DISCORD_ACCESS_TOKEN = 'test-token'
        discordFetch.mockReset()
        discordFetch.mockResolvedValue(undefined)
        storage.copy.mockReset()
        storage.delete.mockReset()
        storage.listAll.mockReset()
        log.error.mockReset()
        log.info.mockReset()
        log.warn.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.resetModules()
        vi.unstubAllGlobals()
        delete process.env.R2_PUBLIC_BASE_URL
        delete process.env.LIRIA_DISCORD_ENDPOINT
        delete process.env.LIRIA_DISCORD_ACCESS_TOKEN
        delete runtimeGlobal.__env__
    })

    it('keeps referenced setup and avatar images and skips recent orphan images', async () => {
        arrange({
            rows: {
                setupImages: [{ objectKey: 'setup/used.jpg' }],
                setupDraftImages: [{ objectKey: 'setup/draft-used.jpg' }],
                users: [{ image: `${publicBaseUrl}/avatar/used.jpg` }],
            },
            setupObjects: [
                { key: 'setup/used.jpg', lastModified: oldDate },
                { key: 'setup/draft-used.jpg', lastModified: oldDate },
                { key: 'setup/recent-orphan.jpg', lastModified: recentDate },
                { key: 'setup/old-orphan.jpg', lastModified: oldDate },
            ],
            avatarObjects: [
                { key: 'avatar/used.jpg', lastModified: oldDate },
                { key: 'avatar/old-orphan.jpg', lastModified: oldDate },
            ],
        })

        const result = await runCleanupJob(true)

        expect(result.data).toMatchObject({
            candidates: ['setup/old-orphan.jpg', 'avatar/old-orphan.jpg'],
            wouldDelete: ['setup/old-orphan.jpg', 'avatar/old-orphan.jpg'],
            totalWouldProcess: 2,
        })
        expect(storage.copy).not.toHaveBeenCalled()
        expect(storage.delete).not.toHaveBeenCalled()
        expect(discordFetch).not.toHaveBeenCalled()
    })

    it('treats old storage objects as cleanup candidates when DB rows are empty', async () => {
        arrange({
            setupObjects: [{ key: 'setup/orphan.jpg', lastModified: oldDate }],
            avatarObjects: [{ key: 'avatar/orphan.jpg', lastModified: oldDate }],
        })

        const result = await runCleanupJob(true)

        expect(result.data).toMatchObject({
            candidates: ['setup/orphan.jpg', 'avatar/orphan.jpg'],
            totalWouldProcess: 2,
        })
    })

    it('ignores external profile URLs when deriving used R2 keys', async () => {
        arrange({
            rows: {
                users: [{ image: 'https://pbs.twimg.com/profile_images/avatar/old-orphan.jpg' }],
            },
            avatarObjects: [{ key: 'avatar/old-orphan.jpg', lastModified: oldDate }],
        })

        const result = await runCleanupJob(true)

        expect(result.data).toMatchObject({
            candidates: ['avatar/old-orphan.jpg'],
            totalWouldProcess: 1,
        })
    })

    it('uses R2 public base URL from runtime env when process env is unavailable', async () => {
        delete process.env.R2_PUBLIC_BASE_URL
        runtimeGlobal.__env__ = { R2_PUBLIC_BASE_URL: `${publicBaseUrl}/` }
        arrange({
            rows: {
                setupImages: [{ objectKey: 'setup/used.jpg' }],
            },
            setupObjects: [{ key: 'setup/used.jpg', lastModified: oldDate }],
        })

        const result = await runCleanupJob(true)

        expect(result.data).toMatchObject({
            candidates: [],
            totalWouldProcess: 0,
        })
    })

    it('skips cleanup when R2 public base URL is unavailable', async () => {
        delete process.env.R2_PUBLIC_BASE_URL
        arrange({
            rows: {
                setupImages: [{ objectKey: 'setup/used.jpg' }],
            },
            setupObjects: [{ key: 'setup/used.jpg', lastModified: oldDate }],
        })

        const result = await runCleanupJob(true)

        expect(result).toMatchObject({
            success: false,
            dryRun: true,
            message: 'R2_PUBLIC_BASE_URL is not configured. Cleanup skipped.',
            data: {
                candidates: [],
                wouldDelete: [],
                totalWouldProcess: 0,
            },
        })
        expect(storage.listAll).not.toHaveBeenCalled()
    })

    it('deletes only images that were backed up successfully', async () => {
        arrange({
            setupObjects: [
                { key: 'setup/backed-up.jpg', lastModified: oldDate },
                { key: 'setup/backup-failed.jpg', lastModified: oldDate },
            ],
        })
        storage.copy.mockImplementation((key: string) => {
            if (key === 'setup/backup-failed.jpg') throw new Error('copy failed')
            return Promise.resolve()
        })
        storage.delete.mockResolvedValue({ deleted: ['setup/backed-up.jpg'] })

        const result = await runCleanupJob()

        expect(storage.delete).toHaveBeenCalledWith(['setup/backed-up.jpg'], { concurrency: 8 })
        expect(result.data).toMatchObject({
            candidates: ['setup/backed-up.jpg', 'setup/backup-failed.jpg'],
            backedUp: ['setup/backed-up.jpg'],
            backupFailed: ['setup/backup-failed.jpg'],
            skippedBecauseBackupFailed: ['setup/backup-failed.jpg'],
            successfulDeletes: ['setup/backed-up.jpg'],
            totalProcessed: 2,
        })
        expect(result.data.backupFailures).toEqual([
            { key: 'setup/backup-failed.jpg', error: 'copy failed' },
        ])
        expect(discordFetch).toHaveBeenCalledWith('/admin/message', {
            baseURL: discordEndpoint,
            method: 'POST',
            headers: { Authorization: 'Bearer test-token' },
            body: expect.objectContaining({ embeds: expect.any(Array) }),
        })
    })

    it('reports delete partial failures', async () => {
        arrange({
            setupObjects: [
                { key: 'setup/deleted.jpg', lastModified: oldDate },
                { key: 'setup/delete-failed.jpg', lastModified: oldDate },
            ],
        })
        storage.copy.mockResolvedValue(undefined)
        storage.delete.mockResolvedValue({
            deleted: ['setup/deleted.jpg'],
            errors: [{ key: 'setup/delete-failed.jpg', error: new Error('delete failed') }],
        })

        const result = await runCleanupJob()

        expect(result.data).toMatchObject({
            successfulDeletes: ['setup/deleted.jpg'],
            failedDeletes: [{ key: 'setup/delete-failed.jpg', error: 'delete failed' }],
            totalProcessed: 2,
        })
        expect(log.error).toHaveBeenCalledWith(
            'Failed to delete image:',
            'setup/delete-failed.jpg',
            expect.any(Error),
        )
    })
})
