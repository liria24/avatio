import { generateAvailableSetupId, matchSetupPath, setupPath } from '@avatio/core/setups'
import { nanoid } from 'nanoid'

import { reservedRootPaths, routeLocales, staticPagePaths } from '#avatio/routes'

export const setupIdPolicy = {
    isReserved: (id: string) => reservedRootPaths.has(id.toLowerCase()),
}

export const getSetupPath = (id: string) => setupPath(id, setupIdPolicy)

export const getSetupIdFromPath = (pathname: string) =>
    matchSetupPath(pathname, setupIdPolicy, routeLocales, staticPagePaths)

export const generateNewSetupId = (db: AppDatabase) =>
    generateAvailableSetupId({
        policy: setupIdPolicy,
        repository: {
            exists: async (id) =>
                Boolean(
                    await db.query.setups.findFirst({
                        where: { id: { eq: id } },
                        columns: { id: true },
                    }),
                ),
        },
        generate: () => nanoid(8),
    })
