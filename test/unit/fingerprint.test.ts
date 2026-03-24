import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getFingerprint } from '../../server/utils/fingerprint'

const mockUseEvent = vi.fn().mockReturnValue({})
const mockGetHeaders = vi.fn()
const mockGetRequestIP = vi.fn()

vi.stubGlobal('useEvent', mockUseEvent)
vi.stubGlobal('getHeaders', mockGetHeaders)
vi.stubGlobal('getRequestIP', mockGetRequestIP)

describe('getFingerprint', () => {
    beforeEach(() => {
        mockGetHeaders.mockReturnValue({ 'user-agent': 'Mozilla/5.0' })
        mockGetRequestIP.mockReturnValue('127.0.0.1')
    })

    it('returns a 40-character lowercase hex string (SHA-1)', async () => {
        const fp = await getFingerprint()
        expect(fp).toMatch(/^[0-9a-f]{40}$/)
    })

    it('returns the same hash for the same IP and user-agent', async () => {
        expect(await getFingerprint()).toBe(await getFingerprint())
    })

    it('returns different hashes for different IPs', async () => {
        mockGetRequestIP.mockReturnValueOnce('192.168.1.1')
        const fp1 = await getFingerprint()

        mockGetRequestIP.mockReturnValueOnce('10.0.0.1')
        const fp2 = await getFingerprint()

        expect(fp1).not.toBe(fp2)
    })

    it('returns different hashes for different user-agents', async () => {
        mockGetHeaders.mockReturnValueOnce({ 'user-agent': 'Chrome/120' })
        const fp1 = await getFingerprint()

        mockGetHeaders.mockReturnValueOnce({ 'user-agent': 'Firefox/121' })
        const fp2 = await getFingerprint()

        expect(fp1).not.toBe(fp2)
    })

    it('falls back to "unknown" when user-agent header is absent', async () => {
        mockGetHeaders.mockReturnValue({})
        const fp = await getFingerprint()
        expect(fp).toMatch(/^[0-9a-f]{40}$/)
    })
})
