import { getCatalogSyncQueue } from '../../../server/utils/catalog/runtime'
import { getRuntimeStageConfig } from '../../../server/utils/runtimeEnv'

afterEach(() => vi.unstubAllGlobals())

it.each(['production', 'development'])(
    'sends catalog work through the %s Queue with its lease token',
    async (stage) => {
        const send = vi.fn()
        vi.stubGlobal('__env__', { STAGE: stage, ITEM_REVALIDATION_QUEUE: { send } })
        const message = {
            version: 2 as const,
            type: 'catalog.sync-source' as const,
            sourceId: 'source',
            leaseToken: 'lease',
        }
        await getCatalogSyncQueue()!.enqueue(message)
        expect(send).toHaveBeenCalledWith(message)
    },
)

it('does not select a deployed stage when its binding is missing or invalid', () => {
    for (const stage of [undefined, 'pr-354']) {
        vi.stubGlobal('__env__', { STAGE: stage })
        expect(() => getRuntimeStageConfig()).toThrow('Stage must be explicitly set')
    }
})
