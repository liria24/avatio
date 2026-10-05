import { randomUUID } from 'node:crypto'

import { createDefaultSetupComposeForm } from '@avatio/core/setups'
import { PNG } from 'pngjs'

import { catalogItems, itemSources, setupEntries, setups } from '../../database/schema'
import type { FixtureUser, TestRuntime } from './runtime'

export const seedCatalogItem = async (runtime: TestRuntime, name = 'Fixture Catalog Item') => {
    const id = randomUUID()
    await runtime.db.insert(catalogItems).values({ id })
    await runtime.db.insert(itemSources).values({
        id: randomUUID(),
        itemId: id,
        providerKey: 'github',
        externalId: `fixture/${id}`,
        canonicalUrl: `https://github.com/fixture/${id}`,
        primary: true,
        displayName: name,
        mappedCategory: 'other',
        availability: 'available',
        syncState: 'fresh',
        lastCheckedAt: new Date(),
        lastSuccessfulSyncAt: new Date(),
        nextCheckAt: new Date('2100-01-01'),
    })
    return { id, name }
}

export const seedSetup = async (
    runtime: TestRuntime,
    owner: FixtureUser,
    options: { public?: boolean; hidden?: boolean; id?: string } = {},
) => {
    const item = await seedCatalogItem(runtime)
    const id = options.id ?? `fixture_${randomUUID()}`
    await runtime.db.insert(setups).values({
        id,
        userId: owner.id,
        name: 'Fixture Setup',
        public: options.public ?? true,
        hidAt: options.hidden ? new Date() : null,
    })
    await runtime.db
        .insert(setupEntries)
        .values({ id: randomUUID(), setupId: id, itemId: item.id, position: 0 })
    return { id, item }
}

export const draftContent = (name: string) => ({ ...createDefaultSetupComposeForm(), name })
export const fixturePng = () => {
    const png = new PNG({ width: 32, height: 32 })
    for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 80
        png.data[i + 1] = 120
        png.data[i + 2] = 200
        png.data[i + 3] = 255
    }
    return PNG.sync.write(png)
}
