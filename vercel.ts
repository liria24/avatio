import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
    cleanUrls: true,
    trailingSlash: false,
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
    headers: [
        {
            source: '/(.*).html',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
        },
        {
            source: '/sw.js',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
        },
        {
            source: '/manifest.webmanifest',
            headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
        },
        {
            source: '/assets/(.*)',
            headers: [{ key: 'Cache-Control', value: 'max-age=31536000, immutable' }],
        },
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-XSS-Protection', value: '1; mode=block' },
            ],
        },
    ],
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
}
