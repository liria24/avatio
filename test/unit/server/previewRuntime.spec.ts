import { getCatalogSyncQueue } from '../../../server/utils/catalogRuntime'

afterEach(() => vi.unstubAllGlobals())

describe('development Preview runtime boundaries', () => {
    it('keeps the production Queue adapter and rejects forged production Preview identity', () => {
        vi.stubGlobal('__env__', {
            STAGE: 'production',
            ITEM_REVALIDATION_QUEUE: { send: vi.fn() },
        })
        expect(getCatalogSyncQueue()).not.toBeNull()
        vi.stubGlobal('__env__', { STAGE: 'production', PREVIEW_NAME: 'development' })
        expect(() => getCatalogSyncQueue()).toThrow('Previews require the development stage')
    })

    it('rejects removed PR Preview identities before creating a sync adapter', () => {
        vi.stubGlobal('__env__', { STAGE: 'development', PREVIEW_NAME: 'pr-354' })
        expect(() => getCatalogSyncQueue()).toThrow('Preview name must be development')
    })
})
