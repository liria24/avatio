import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
    cleanUrls: true,
    trailingSlash: false,
    bunVersion: '1.x',
    images: {
        minimumCacheTTL: 2678400, // 31 days
        sizes: [24, 32, 48, 88, 256, 320, 640, 1080, 2048, 3840],
    },
    crons: [
        {
            path: '/api/admin/job/report',
            schedule: '0 22 * * *',
        },
        {
            path: '/api/admin/job/cleanup',
            schedule: '0 22 * * *',
        },
    ],
}
