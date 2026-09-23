import { setupPath as coreSetupPath } from '@avatio/core/setups'
import { useNuxtApp } from 'nuxt/app'

import { reservedRootPaths } from '#avatio/routes'

export const avatioSetupIdPolicy = {
    isReserved: (id: string) => reservedRootPaths.has(id.toLowerCase()),
}

export const useSetupPath = () => {
    const { $localePath } = useNuxtApp() as unknown as {
        $localePath: (path: string) => string
    }

    return (id: string) => $localePath(coreSetupPath(id, avatioSetupIdPolicy))
}
