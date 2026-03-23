import { get } from '@vercel/edge-config'

export const config = {
    matcher: [
        '/((?!api|_nuxt(?:/.*)?|favicon.ico|favicon.svg|ogp.png|ogp_2.png|sw\\.js|manifest\\.webmanifest|workbox-.*\\.js).*)',
    ],
}

export default async function middleware(request: Request) {
    try {
        const isMaintenance = await get('isMaintenance')

        const url = new URL(request.url)
        const path = url.pathname

        if (isMaintenance && path !== '/on-maintenance')
            return new Response(null, {
                status: 307,
                headers: { Location: '/on-maintenance' },
            })

        if (!isMaintenance && path === '/on-maintenance')
            return new Response(null, {
                status: 307,
                headers: { Location: '/' },
            })
    } catch (error) {
        console.error('Error in maintenance middleware:', error)
    }
}
