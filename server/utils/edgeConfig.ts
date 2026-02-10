import { getAll } from '@vercel/edge-config'

export const getEdgeConfig = defineCachedFunction(async () => await getAll<EdgeConfig>(), {
    name: 'edge-config',
    maxAge: EDGE_CONFIG_CACHE_TTL,
    swr: false,
})
