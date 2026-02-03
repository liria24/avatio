import { defineOrganization } from 'nuxt-schema-org/schema'

const baseUrl = import.meta.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const title = 'Avatio'
const description = 'あなたのアバター改変を共有しよう'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: 'latest',

    devtools: { enabled: true, timeline: { enabled: true } },

    modules: [
        '@nuxt/ui',
        '@nuxt/image',
        '@nuxt/content',
        '@nuxt/hints',
        '@nuxtjs/device',
        '@nuxtjs/i18n',
        '@nuxtjs/robots',
        '@nuxtjs/sitemap',
        '@pinia/nuxt',
        '@vueuse/nuxt',
        'motion-v/nuxt',
        '@stefanobartoletti/nuxt-social-share',
        'nuxt-link-checker',
        'nuxt-schema-org',
        'nuxt-seo-utils',
        '@nuxt/a11y',
    ],

    css: ['~/assets/css/main.css'],

    vite: {
        ssr: {
            noExternal: ['zod', 'drizzle-zod'],
        },
        vue: {
            features: {
                optionsAPI: false,
            },
        },
        optimizeDeps: {
            include: [
                '@nuxt/ui > prosemirror-state',
                '@nuxt/ui > prosemirror-transform',
                '@nuxt/ui > prosemirror-model',
                '@nuxt/ui > prosemirror-view',
                '@nuxt/ui > prosemirror-gapcursor',
            ],
        },
    },

    routeRules: {
        '/admin/**': {
            appLayout: 'dashboard',
            appMiddleware: 'admin',
        },
        '/faq': {
            isr: 60 * 60 * 24 * 30,
        },
        '/terms': {
            isr: 60 * 60 * 24 * 30,
        },
        '/privacy-policy': {
            isr: 60 * 60 * 24 * 30,
        },
        '/on-maintenance': {
            isr: 60 * 60 * 24 * 30,
        },
        '/setup/edit': {
            redirect: '/setup/compose',
        },
    },

    nitro: {
        preset: 'bun',
        compressPublicAssets: true,
        storage: {
            r2: {
                driver: 's3',
                accessKeyId: import.meta.env.NUXT_R2_ACCESS_KEY || '',
                secretAccessKey: import.meta.env.NUXT_R2_SECRET_KEY || '',
                endpoint: import.meta.env.NUXT_R2_ENDPOINT || '',
                bucket: 'avatio',
                region: 'auto',
            },
            cache: {
                driver: 'upstash',
                url: import.meta.env.NUXT_UPSTASH_KV_REST_API_URL || '',
                token: import.meta.env.NUXT_UPSTASH_KV_REST_API_TOKEN || '',
            },
        },
        devStorage: {
            cache: {
                driver: 'null',
            },
        },
        typescript: {
            tsConfig: {
                compilerOptions: {
                    noUncheckedIndexedAccess: true,
                },
            },
        },
        experimental: {
            asyncContext: true,
        },
    },

    runtimeConfig: {
        adminKey: import.meta.env.ADMIN_KEY || '',
        ai: {
            gateway: {
                apiKey: import.meta.env.AI_GATEWAY_API_KEY || '',
            },
        },
        betterAuth: {
            url: import.meta.env.NUXT_BETTER_AUTH_URL || baseUrl,
            secret: import.meta.env.NUXT_BETTER_AUTH_SECRET || '',
        },
        liria: {
            accessToken: import.meta.env.NUXT_LIRIA_ACCESS_TOKEN || '',
            discordEndpoint: import.meta.env.NUXT_LIRIA_DISCORD_ENDPOINT || '',
        },
        neon: {
            databaseUrl: import.meta.env.NUXT_NEON_DATABASE_URL || '',
        },
        r2: {
            endpoint: import.meta.env.NUXT_R2_ENDPOINT || '',
            accessKey: import.meta.env.NUXT_R2_ACCESS_KEY || '',
            secretKey: import.meta.env.NUXT_R2_SECRET_KEY || '',
        },
        upstash: {
            redisRestUrl: import.meta.env.UPSTASH_REDIS_REST_URL || '',
            redisRestToken: import.meta.env.UPSTASH_REDIS_REST_TOKEN || '',
        },
        vercel: {
            token: import.meta.env.NUXT_VERCEL_TOKEN || '',
            edgeConfig: {
                endpoint: import.meta.env.NUXT_VERCEL_EDGE_CONFIG || '',
            },
        },
        public: {
            siteUrl: baseUrl,
            r2: {
                domain: import.meta.env.TIGRIS_DOMAIN,
            },
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
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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

    content: {
        build: {
            markdown: {
                remarkPlugins: {
                    'remark-breaks': {},
                },
            },
        },
        experimental: { sqliteConnector: 'native' },
    },

    fonts: {
        families: [{ name: 'Geist', provider: 'google' }],
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
                icon: 'twemoji:flag-united-states',
            },
            {
                code: 'ja',
                language: 'ja-JP',
                name: '日本語',
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
        customCollections: [
            {
                prefix: 'avatio',
                dir: './app/assets/icons',
            },
        ],
        clientBundle: {
            icons: [
                'svg-spinners:ring-resize',
                'mingcute:search-line',
                'mingcute:add-line',
                'mingcute:close-line',
                'mingcute:check-line',
                'mingcute:bookmark-line',
                'mingcute:sun-fill',
                'mingcute:moon-fill',
                'mingcute:palette-fill',
                'mingcute:settings-1-fill',
                'mingcute:notification-fill',
                'mingcute:user-3-fill',
                'mingcute:group-2-fill',
                'mingcute:open-door-fill',
                'mingcute:chat-3-fill',
                'mingcute:share-2-fill',
                'mingcute:right-small-fill',
                'mingcute:left-small-fill',
                'mingcute:down-small-fill',
                'mingcute:up-small-fill',
                'mingcute:copy-2-fill',
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },

    image: {
        screens: {
            xsIcon: 24,
            smIcon: 32,
            mdIcon: 48,
            lgIcon: 88,
            xxs: 256,
            xs: 320,
            sm: 640,
            md: 768,
            lg: 1024,
            xl: 1280,
            xxl: 1536,
            '2xl': 1536,
        },
        densities: [1],
        domains: [
            import.meta.env.TIGRIS_DOMAIN!,
            'booth.pximg.net', // booth
            's2.booth.pm', // booth
            'github.com', // GitHub
            'avatars.githubusercontent.com', // GitHub User Avatars
        ],
    },

    mdc: {
        remarkPlugins: {
            'remark-breaks': {},
        },
    },

    robots: {
        blockNonSeoBots: true,
        blockAiBots: true,
    },

    socialShare: {
        baseUrl,
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

    ui: {
        experimental: {
            componentDetection: true,
        },
    },

    experimental: {
        crossOriginPrefetch: true,
        sharedPrerenderData: true,
        extractAsyncDataHandlers: true,
        typescriptPlugin: true,
        inlineRouteRules: true,
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
