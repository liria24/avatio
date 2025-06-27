import { getAll } from '@vercel/edge-config'

export default defineApi(
    async () => {
        const value = await getAll<EdgeConfig>()
        return value
    },
    {
        errorMessage: 'Failed to get item.',
    }
)
