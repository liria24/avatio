import tailwindcss from '@tailwindcss/vite'
import { defineOrganization } from 'nuxt-schema-org/schema'

const baseUrl = import.meta.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const title = 'Avatio'
const description = 'あなたのアバター改変を共有しよう'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    future: {
        compatibilityVersion: 4,
    },

    compatibilityDate: '2024-11-01',

    devtools: { enabled: true, timeline: { enabled: true } },

    modules: [
        '@nuxt/eslint',
        '@nuxt/image',
        '@nuxt/ui',
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
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: import.meta.dev ? ['axe-core'] : [],
        },
    },

    runtimeConfig: {
        adminKey: '',
        liria: { accessToken: '' },
        r2: { endpoint: '', accessKey: '', secretKey: '' },
        ai: { gateway: { apiKey: '' } },
        public: {
            r2: { domain: '' },
        },
    },

    routeRules: {
        '/faq': { prerender: import.meta.dev ? false : true },
        '/terms': { prerender: import.meta.dev ? false : true },
        '/privacy-policy': { prerender: import.meta.dev ? false : true },
        '/api/__sitemap__/urls': { isr: 60 * 60 * 6 },
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
        defaultLocale: 'en',
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
        bundle: {
            optimizeTranslationDirective: false,
        },
        detectBrowserLanguage: {
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
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },

    image: {
        domains: [
            (() => {
                try {
                    const url = new URL(
                        import.meta.env.NUXT_PUBLIC_R2_DOMAIN || ''
                    )
                    return url.hostname
                } catch (error) {
                    console.error('Error parsing R2 domain:', error)
                    return ''
                }
            })(),
            'booth.pximg.net', // booth
            's2.booth.pm', // booth
        ],
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

    nitro: {
        preset: 'vercel',
        experimental: {
            asyncContext: true,
            openAPI: true,
        },
    },

    experimental: {
        scanPageMeta: true,
        payloadExtraction: true,
    },
})
