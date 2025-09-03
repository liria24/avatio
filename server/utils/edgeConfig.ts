import { getAll } from '@vercel/edge-config'

export const getEdgeConfig = defineCachedFunction(
    async () => await getAll<EdgeConfig>(),
    {
        name: 'edge-config',
        maxAge: 5,
        swr: false,
    }
)
