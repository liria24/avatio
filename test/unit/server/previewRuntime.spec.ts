import { getCatalogSyncQueue } from '../../../server/utils/catalogRuntime'
afterEach(() => vi.unstubAllGlobals())

describe('PR Preview runtime boundaries', () => {
    it('keeps the production Queue adapter and rejects a forged production Preview combination', () => {
        vi.stubGlobal('__env__', {
            STAGE: 'production',
            ITEM_REVALIDATION_QUEUE: { send: vi.fn() },
        })
        expect(getCatalogSyncQueue()).not.toBeNull()
        vi.stubGlobal('__env__', { STAGE: 'production', PREVIEW_NAME: 'pr-354' })
        expect(() => getCatalogSyncQueue()).toThrow('Previews require the development stage')
    })
})
