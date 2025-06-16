import tailwindcss from '@tailwindcss/vite'
import { defineOrganization } from 'nuxt-schema-org/schema'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    future: { compatibilityVersion: 4 },

    compatibilityDate: '2024-11-01',

    devtools: { enabled: true, timeline: { enabled: true } },

    modules: [
        '@vueuse/nuxt',
        '@nuxt/image',
        '@nuxt/ui',
        '@nuxtjs/supabase',
        '@nuxt/eslint',
        '@nuxtjs/turnstile',
        '@nuxtjs/robots',
        '@nuxtjs/sitemap',
        'nuxt-link-checker',
        'nuxt-schema-org',
        'nuxt-seo-utils',
        'reka-ui/nuxt',
    ],

    routeRules: {
        '/setup/compose': { ssr: false },
        '/faq': { isr: 600 },
        '/terms': { isr: 600 },
        '/privacy-policy': { isr: 600 },
    },

    css: ['~/assets/css/main.css'],

    vite: {
        plugins: [tailwindcss(), wasm(), topLevelAwait()],
    },

    runtimeConfig: {
        public: { r2: { domain: '' } },
        adminKey: '',
        turnstile: { siteKey: '', secretKey: '' },
        r2: { endpoint: '', accessKey: '', secretKey: '' },
        liria: { accessToken: '' },
    },

    site: {
        url: 'https://avatio.me',
        name: 'Avatio',
        description: 'あなたのアバター改変を共有しよう',
        trailingSlash: false,
    },

    app: {
        head: {
            htmlAttrs: { lang: 'ja', prefix: 'og: https://ogp.me/ns#' },
            title: 'Avatio',
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1',
                },
                { name: 'icon', content: '/favicon.svg' },
                { property: 'og:site_name', content: 'Avatio' },
                { property: 'og:type', content: 'website' },
                { property: 'og:url', content: 'https://avatio.me' },
                { property: 'og:title', content: 'Avatio' },
                { property: 'og:image', content: 'https://avatio.me/ogp.png' },
                {
                    name: 'description',
                    content: 'あなたのアバター改変を共有しよう',
                },
                {
                    property: 'og:description',
                    content: 'あなたのアバター改変を共有しよう',
                },
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
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },

    image: {
        domains: [
            'booth.pximg.net', // booth
            's2.booth.pm', // booth
            import.meta.env.NUXT_PUBLIC_R2_DOMAIN.replace('https://', ''), // R2
        ],
    },

    robots: {
        allow: ['Twitterbot', 'facebookexternalhit'],
        blockNonSeoBots: true,
        blockAiBots: true,
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

    sitemap: {
        sitemaps: true,
        exclude: [
            '/confirm',
            '/login',
            '/search',
            '/setup/compose',
            '/settings',
            '/bookmarks',
        ],
        sources: ['/api/__sitemap__/urls'],
    },

    supabase: {
        url: import.meta.env.SUPABASE_URL,
        key: import.meta.env.SUPABASE_ANON_KEY,
        serviceKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        redirect: true,
        redirectOptions: {
            login: '/login',
            callback: '/',
            include: ['/setup/compose', '/settings', '/bookmarks'],
            exclude: [],
            cookieRedirect: false,
        },
        clientOptions: {
            auth: {
                flowType: 'pkce',
            },
        },
        types: '@/shared/types/database.ts',
    },

    turnstile: { siteKey: import.meta.env.NUXT_TURNSTILE_SITE_KEY },

    nitro: {
        preset: 'vercel',
        experimental: {
            asyncContext: true,
            openAPI: true,
        },
    },

    experimental: {
        typedPages: true,
        scanPageMeta: true,
        payloadExtraction: true,
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
