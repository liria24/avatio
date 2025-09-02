import { defineOrganization } from 'nuxt-schema-org/schema'

const baseUrl = import.meta.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const title = 'Avatio'
const description = 'あなたのアバター改変を共有しよう'
const r2Domain = (() => {
    try {
        const url = new URL(import.meta.env.NUXT_PUBLIC_R2_DOMAIN || '')
        return url.hostname
    } catch (error) {
        console.error('Error parsing R2 domain:', error)
        return ''
    }
})()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-28',

    devtools: { enabled: true, timeline: { enabled: true } },

    modules: [
        '@nuxt/eslint',
        '@nuxt/image',
        '@nuxt/ui',
        '@nuxtjs/device',
        '@nuxtjs/i18n',
        '@nuxtjs/mdc',
        '@nuxtjs/robots',
        '@nuxtjs/sitemap',
        '@pinia/nuxt',
        '@stefanobartoletti/nuxt-social-share',
        '@vueuse/nuxt',
        'nuxt-link-checker',
        'nuxt-schema-org',
        'nuxt-seo-utils',
    ],

    plugins: [{ src: '~/plugins/axe.client.ts', mode: 'client' }],

    css: ['~/assets/css/main.css'],

    vite: {
        optimizeDeps: {
            include: import.meta.dev ? ['axe-core'] : [],
        },
    },

    routeRules: {
        '/api/items': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 5}`,
            },
        },
        '/api/items/*': {
            headers: {
                'Cache-Control': `max-age=${60 * 60}`,
                'CDN-Cache-Control': `max-age=${60 * 60 * 24}`,
            },
        },
        '/api/items/extract-item-name': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${0}`,
            },
        },
        '/api/items/owned-avatars': {
            headers: {
                'Cache-Control': `max-age=${60 * 10}`,
            },
        },
        '/api/items/popular-avatars': {
            headers: {
                'Cache-Control': `max-age=${60 * 60}`,
                'CDN-Cache-Control': `max-age=${60 * 60 * 24}`,
            },
        },
        '/api/setups': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 30}`,
            },
        },
        '/api/setups/*': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 60}`,
            },
        },
        '/api/setups/tag': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 60}`,
            },
        },
        '/api/setups/drafts': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${0}`,
            },
        },
        '/api/users': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 30}`,
            },
        },
        '/api/users/*': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 60}`,
            },
        },
        '/api/users/id-availability': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${0}`,
            },
        },
        '/api/users/is-initialized': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${0}`,
            },
        },
        '/api/changelogs': {
            headers: {
                'Cache-Control': `max-age=${60 * 60}`,
                'CDN-Cache-Control': `max-age=${60 * 60 * 24}`,
            },
        },
        '/api/__sitemap__/urls': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 60}`,
            },
        },
        '/': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${30}`,
            },
        },
        '/setups/*': {
            headers: {
                'Cache-Control': `max-age=${60}`,
                'CDN-Cache-Control': `max-age=${60 * 60}`,
            },
        },
        '/setups/compose': {
            headers: {
                'Cache-Control': `max-age=${0}`,
                'CDN-Cache-Control': `max-age=${0}`,
            },
        },
        '/changelogs': {
            headers: {
                'Cache-Control': `max-age=${60 * 60}`,
                'CDN-Cache-Control': `max-age=${60 * 60 * 24}`,
            },
        },
        '/faq': {
            prerender: true,
        },
        '/terms': {
            prerender: true,
        },
        '/privacy-policy': {
            prerender: true,
        },
        '/on-maintenance': {
            prerender: true,
        },
        '/setup/edit': {
            redirect: '/setup/compose',
        },
    },

    nitro: {
        preset: 'vercel',
        compressPublicAssets: true,
        storage: {
            r2: {
                driver: 's3',
                accessKeyId: import.meta.env.NUXT_R2_ACCESS_KEY,
                secretAccessKey: import.meta.env.NUXT_R2_SECRET_KEY,
                endpoint: import.meta.env.NUXT_R2_ENDPOINT,
                bucket: 'avatio',
                region: 'auto',
            },
            cache: {
                driver: 'vercel-runtime-cache',
                base: 'avatio',
            },
        },
        vercel: {
            config: {
                images: {
                    minimumCacheTTL: 2678400, // 31 days
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
            },
        },
        experimental: {
            asyncContext: true,
            openAPI: true,
        },
    },

    runtimeConfig: {
        adminKey: '',
        ai: { gateway: { apiKey: '' } },
        betterAuth: { url: baseUrl, secret: '' },
        liria: { accessToken: '' },
        neon: { databaseUrl: '' },
        r2: { endpoint: '', accessKey: '', secretKey: '' },
        vercel: { token: '', edgeConfig: { endpoint: '' } },
        public: {
            siteUrl: baseUrl,
            r2: { domain: r2Domain },
        },
    },

    site: {
        url: baseUrl,
        name: title,
        description,
        trailingSlash: false,
    },

    app: {
        head: {
            htmlAttrs: { lang: 'ja', prefix: 'og: https://ogp.me/ns#' },
            title,
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1',
                },
                { name: 'icon', content: '/favicon.svg' },
                { property: 'og:site_name', content: title },
                { property: 'og:type', content: 'website' },
                { property: 'og:url', content: 'https://avatio.me' },
                { property: 'og:title', content: title },
                { property: 'og:image', content: 'https://avatio.me/ogp.png' },
                { name: 'description', content: description },
                { property: 'og:description', content: description },
                { name: 'twitter:site', content: '@liria_24' },
                { name: 'twitter:card', content: 'summary_large_image' },
            ],
        },
    },

    fonts: {
        families: [
            { name: 'Noto Sans JP', provider: 'google' },
            { name: 'Geist', provider: 'google' },
        ],
        defaults: {
            weights: [100, 200, 300, 300, 400, 500, 600, 700, 800, 900],
        },
    },

    i18n: {
        baseUrl,
        defaultLocale: 'ja',
        locales: [
            {
                code: 'en',
                language: 'en-US',
                name: 'English (US)',
                file: 'en.json',
                icon: 'twemoji:flag-united-states',
            },
            {
                code: 'ja',
                language: 'ja-JP',
                name: '日本語',
                file: 'ja.json',
                icon: 'twemoji:flag-japan',
            },
        ],
        detectBrowserLanguage: {
            redirectOn: 'root',
            useCookie: true,
            cookieKey: 'i18n_redirected',
        },
    },

    icon: {
        customCollections: [{ prefix: 'avatio', dir: './app/assets/icons' }],
        clientBundle: {
            icons: [
                'lucide:search',
                'lucide:plus',
                'lucide:x',
                'lucide:check',
                'svg-spinners:ring-resize',
                'lucide:bookmark',
                'lucide:sun',
                'lucide:moon',
                'lucide:palette',
                'lucide:bolt',
                'lucide:bell',
                'lucide:user-round',
                'lucide:users-round',
                'lucide:log-out',
                'lucide:message-square',
                'lucide:share-2',
                'lucide:chevron-right',
                'lucide:chevron-left',
                'lucide:chevron-down',
                'lucide:chevron-up',
                'lucide:copy',
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },

    image: {
        domains: [
            r2Domain, // R2
            'booth.pximg.net', // booth
            's2.booth.pm', // booth
            'avatars.githubusercontent.com', // GitHub User Avatars
        ],
        alias: {
            avatio: `https://${r2Domain}`,
            booth: 'https://booth.pximg.net',
            boothS2: 'https://s2.booth.pm',
            githubAvatar: 'https://avatars.githubusercontent.com',
        },
    },

    mdc: {
        remarkPlugins: {
            'remark-breaks': {},
        },
    },

    socialShare: {
        baseUrl,
    },

    robots: {
        allow: ['Twitterbot', 'facebookexternalhit'],
        blockNonSeoBots: true,
        blockAiBots: true,
    },

    sitemap: {
        sitemaps: true,
        exclude: ['/confirm'],
        sources: ['/api/__sitemap__/urls'],
    },

    schemaOrg: {
        identity: defineOrganization({
            name: 'Liria',
            description: 'Small Circle by Liry24',
            logo: {
                url: '/logo-liria.png',
                width: 460,
                height: 460,
            },
            email: 'hello@liria.me',
            sameAs: ['https://x.com/liria_24', 'https://github.com/liria24'],
        }),
    },

    experimental: {
        crossOriginPrefetch: true,
        sharedPrerenderData: true,
    },
})

//
//                       _oo0oo_
//                      o8888888o
//                      88" . "88
//                      (| -_- |)
//                      0\  =  /0
//                    ___/`---'\___
//                  .' \\|     |// '.
//                 / \\|||  :  |||// \
//                / _||||| -:- |||||- \
//               |   | \\\  -  /// |   |
//               | \_|  ''\---/''  |_/ |
//               \  .-\__  '-'  ___/-. /
//             ___'. .'  /--.--\  `. .'___
//          ."" '<  `.___\_<|>_/___.' >' "".
//         | | :  `- \`.;`\ _ /`;.`/ - ` : | |
//         \  \ `_.   \_ __\ /__ _/   .-` /  /
//     =====`-.____`.___ \_____/___.-`___.-'=====
//                       `=---='
//
//
//     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
//               佛祖保佑         永无BUG
//
