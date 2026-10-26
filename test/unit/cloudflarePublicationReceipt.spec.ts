import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { recordCloudflarePublication } from '../../scripts/cloudflarePublicationReceipt'

const sourceSha = 'a'.repeat(40)
const deploymentId = '00000000-0000-4000-8000-000000000001'
const versionId = '00000000-0000-4000-8000-000000000002'
const deployment = { id: deploymentId, versions: [{ version_id: versionId, percentage: 100 }] }

it.each([false, true])(
    'retains actual publication IDs when later metadata fails=%s without copying secret values',
    (fail) => {
        const root = mkdtempSync(join(tmpdir(), 'avatio-receipt-'))
        const query = vi
            .fn()
            .mockReturnValueOnce(deployment)
            .mockImplementationOnce(() => {
                if (fail) throw new Error('provider response contains a secret')
                return {
                    resources: {
                        bindings: [
                            { name: 'AVATIO_SOURCE_SHA', type: 'plain_text', text: sourceSha },
                            { name: 'SECRET', type: 'plain_text', text: 'never-retain-this-value' },
                        ],
                    },
                }
            })
        try {
            const run = () => recordCloudflarePublication('development', sourceSha, root, query)
            if (fail) expect(run).toThrow('observed IDs are retained')
            else expect(run().exactSourceVerified).toBe(true)
            const text = readFileSync(join(root, '.cloudflare/delivery/published.json'), 'utf8')
            expect(JSON.parse(text)).toMatchObject({
                deploymentId,
                versions: [{ versionId, percentage: 100 }],
                exactSourceVerified: !fail,
            })
            expect(text).not.toContain('secret')
            expect(text).not.toContain('never-retain')
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    },
)
