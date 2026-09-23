import { getAiTaskModel, type AiTaskModels } from '@avatio/cloudflare'

describe('semantic AI task configuration', () => {
    it('selects models independently for each task', () => {
        const models: AiTaskModels = {
            catalogEnrichment: 'provider/catalog-v1',
            changelogTranslation: 'provider/translation-v1',
            changelogSlug: 'provider/slug-v1',
        }
        const changed = { ...models, changelogTranslation: 'provider/translation-v2' }

        expect(getAiTaskModel(changed, 'changelogTranslation')).toBe('provider/translation-v2')
        expect(getAiTaskModel(changed, 'catalogEnrichment')).toBe(
            getAiTaskModel(models, 'catalogEnrichment'),
        )
        expect(getAiTaskModel(changed, 'changelogSlug')).toBe(
            getAiTaskModel(models, 'changelogSlug'),
        )
    })
})
