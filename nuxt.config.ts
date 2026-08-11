import { useNuxt } from '@nuxt/kit'
import type { NitroRouteConfig } from 'nitropack'
import { defineOrganization } from 'nuxt-schema-org/schema'
import { withLeadingSlash } from 'ufo'

import {
    defaultI18nLocale,
    i18nRoutingStrategy,
    prefixedI18nLocales,
} from './shared/utils/i18nRouting'

const baseUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:3000'
const publicUrl = 'https://avatio.me'
const r2PublicBaseUrl = process.env.NUXT_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL
const imageDomain = r2PublicBaseUrl ? new URL(r2PublicBaseUrl).hostname : undefined
const emailFromAddress =
    process.env.NUXT_EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || 'hello@avatio.me'
const title = 'Avatio'
const description = 'アバター改変レシピの共有プラットフォーム'

const normalizeRuntimeConfigForVitest = () => {
    if (!process.env.VITEST) return

    const nuxt = useNuxt()
    nuxt.options.runtimeConfig = JSON.parse(JSON.stringify(nuxt.options.runtimeConfig))
}

const baseRouteRules: { [path: string]: NitroRouteConfig } = {
    '/admin/**': {
        appLayout: 'dashboard',
        appMiddleware: 'admin',
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
    '/setup': {
        redirect: '/',
    },
    '/setup/edit': {
        redirect: '/setup/compose',
    },
    '/bookmarks': {
        redirect: '/?tab=bookmarked',
    },
    '/api/**': {
        cors: true,
    },
}

const routeRules: { [path: string]: NitroRouteConfig } = {
    ...baseRouteRules,
    ...Object.fromEntries(
        prefixedI18nLocales.flatMap((locale) =>
            Object.entries(baseRouteRules).map(([path, config]) => {
                const localizedPath = withLeadingSlash(`${locale}${path}`)
                const localizedConfig = { ...config }

                if (localizedConfig.redirect && typeof localizedConfig.redirect === 'string')
                    localizedConfig.redirect = withLeadingSlash(
                        `${locale}${localizedConfig.redirect}`,
                    )

                return [localizedPath, localizedConfig]
            }),
        ),
    ),
}

const rateLimitBindings = {
    ratelimits: [
        {
            name: 'RATE_LIMIT_USER_ACTION',
            namespace_id: '2101',
            simple: {
                limit: 5,
                period: 60,
            },
        },
        {
            name: 'RATE_LIMIT_IMAGE',
            namespace_id: '2102',
            simple: {
                limit: 30,
                period: 60,
            },
        },
        {
            name: 'RATE_LIMIT_DRAFT',
            namespace_id: '2103',
            simple: {
                limit: 120,
                period: 60,
            },
        },
    ],
} as const

// Nitro forwards this to the generated Wrangler config. Its bundled type has not yet added `cache`.
const workersCacheConfig = {
    cache: {
        enabled: true,
    },
} as const

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2026-05-26',

    future: {
        compatibilityVersion: 5,
    },

    devtools: { enabled: true, timeline: { enabled: true } },

    hooks: {
        'modules:done': normalizeRuntimeConfigForVitest,
        'vite:extendConfig': normalizeRuntimeConfigForVitest,
    },

    modules: [
        '@comark/nuxt',
        '@nuxt/ui',
        '@nuxt/image',
        '@nuxt/fonts',
        '@nuxt/scripts',
        '@nuxtjs/robots',
        '@nuxtjs/sitemap',
        'nuxt-link-checker',
        'nuxt-schema-org',
        'nuxt-seo-utils',
        '@nuxt/content',
        '@nuxt/hints',
        '@nuxtjs/device',
        '@nuxtjs/i18n',
        '@vueuse/nuxt',
        'motion-v/nuxt',
        '@stefanobartoletti/nuxt-social-share',
        '@nuxt/a11y',
        '@nuxt/test-utils/module',
        '@liria24/og-image/nuxt',
        ...(process.env.VITEST ? [] : ['@vite-pwa/nuxt']),
    ],

    css: ['~/assets/css/main.css'],

    vite: {
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

    routeRules,

    nitro: {
        preset: 'cloudflare-module',
        cloudflare: {
            deployConfig: true,
            wrangler: {
                name: 'avatio',
                ...workersCacheConfig,
                compatibility_flags: ['no_handle_cross_request_promise_resolution'],
                observability: {
                    enabled: true,
                    head_sampling_rate: Number(
                        process.env.CLOUDFLARE_OBSERVABILITY_HEAD_SAMPLING_RATE ?? 1,
                    ),
                },
                account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
                d1_databases: [
                    {
                        binding: 'DB',
                        database_name: 'avatio-content',
                    },
                ],
                kv_namespaces: [
                    {
                        binding: 'KV',
                        id: '8d93b5819aab49df9d3244c84a7741ed',
                    },
                ],
                r2_buckets: [
                    {
                        binding: 'R2',
                        bucket_name: 'avatio',
                    },
                ],
                ai: {
                    binding: 'AI',
                },
                send_email: [
                    {
                        name: 'EMAIL',
                    },
                ],
                ...rateLimitBindings,
                triggers: {
                    crons: ['0 22 * * *'],
                },
                queues: {
                    producers: [
                        {
                            queue: 'item-revalidation',
                            binding: 'ITEM_REVALIDATION_QUEUE',
                        },
                    ],
                    consumers: [
                        {
                            queue: 'item-revalidation',
                            max_batch_size: 10,
                            max_batch_timeout: 5,
                            max_retries: 3,
                        },
                    ],
                },
            },
        },
        compressPublicAssets: true,
        storage: {
            auth: {
                driver: 'cloudflare-kv-binding',
                binding: 'KV',
                base: 'auth',
            },
            cache: {
                driver: 'cloudflare-kv-binding',
                binding: 'KV',
                base: 'cache',
            },
            flags: {
                driver: 'cloudflare-kv-binding',
                binding: 'KV',
                base: 'flags',
            },
        },
        devStorage: {
            auth: {
                driver: 'fs-lite',
                base: './.data/storage/auth',
            },
            cache: {
                driver: 'null',
            },
            flags: {
                driver: 'fs-lite',
                base: './.data/storage/flags',
            },
        },
        experimental: {
            asyncContext: true,
            tasks: true,
        },
        unenv: {
            external: ['node:async_hooks'],
        },
    },

    typescript: {
        typeCheck: 'build',
        tsConfig: {
            include: ['test/unit/**/*'],
            compilerOptions: {
                noUncheckedIndexedAccess: true,
            },
        },
    },

    runtimeConfig: {
        cloudflare: {
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: process.env.CLOUDFLARE_API_TOKEN,
        },
        betterAuth: {
            secret: process.env.BETTER_AUTH_SECRET,
        },
        booth: {
            proxyUrl: process.env.NUXT_BOOTH_PROXY_URL,
        },
        neon: {
            databaseUrl: process.env.NEON_DATABASE_URL,
        },
        email: {
            fromAddress: emailFromAddress,
        },
        public: {
            siteUrl: baseUrl,
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
                { property: 'og:site_name', content: title },
                { property: 'og:type', content: 'website' },
                { property: 'og:url', content: baseUrl },
                { property: 'og:title', content: title },
                { property: 'og:image', content: `${baseUrl}/ogp_2.png` },
                { name: 'description', content: description },
                { property: 'og:description', content: description },
                { name: 'twitter:site', content: '@liria_24' },
                { name: 'twitter:card', content: 'summary_large_image' },
            ],
            link: [
                { rel: 'icon', href: `/favicon.ico`, sizes: '48x48' },
                { rel: 'apple-touch-icon', href: `/pwa-192x192.png`, sizes: '192x192' },
            ],
        },
    },

    content: {
        renderer: {
            anchorLinks: false,
        },
        build: {
            markdown: {
                contentHeading: false,
            },
        },
        database: {
            type: 'd1',
            bindingName: 'DB',
        },
        experimental: { sqliteConnector: 'native' },
    },

    fonts: {
        families: [
            {
                name: 'Geist',
                provider: 'google',
                preload: true,
                global: true,
                weights: [200, 300, 400, 500, 600, 700],
            },
            {
                name: 'Geist Mono',
                provider: 'google',
                preload: true,
                global: true,
                weights: [200, 400, 600],
            },
            {
                name: 'Noto Sans JP',
                provider: 'google',
                global: true,
                weights: [400, 500],
            },
        ],
    },

    i18n: {
        baseUrl,
        strategy: i18nRoutingStrategy,
        defaultLocale: defaultI18nLocale,
        locales: [
            {
                code: 'en',
                language: 'en-US',
                name: 'English (US)',
                file: 'en-US.json',
                icon: 'twemoji:flag-united-states',
            },
            {
                code: 'ja',
                language: 'ja-JP',
                name: '日本語',
                file: 'ja-JP.json',
                icon: 'twemoji:flag-japan',
            },
        ],
        detectBrowserLanguage: {
            redirectOn: 'root',
            useCookie: true,
            cookieKey: 'i18n_redirected',
        },
        compilation: {
            strictMessage: false,
        },
    },

    icon: {
        customCollections: [{ prefix: 'avatio', dir: './app/assets/icons' }],
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
                'mingcute:right-line',
                'mingcute:left-line',
                'mingcute:down-line',
                'mingcute:up-line',
                'mingcute:copy-2-fill',
                'mingcute:baby-fill',
                'mingcute:hair-fill',
                'mingcute:dress-fill',
                'mingcute:bowknot-fill',
                'mingcute:pic-fill',
                'mingcute:shadow-fill',
                'mingcute:tool-fill',
                'mingcute:package-2-fill',
                'fluent-color:code-block-24',
                'fluent-color:animal-paw-print-24',
                'fluent-color:chat-multiple-24',
                'fluent-color:ribbon-star-24',
                'fluent-color:building-store-24',
                'fluent-color:shield-24',
                'fluent-color:lightbulb-24',
                'twemoji:flag-united-states',
                'twemoji:flag-japan',
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },

    image: {
        provider: 'cloudflare',
        cloudflare: { baseURL: publicUrl },
        screens: {
            mdIcon: 48,
            lgIcon: 88,
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
            ...(imageDomain ? [imageDomain] : []),
            'booth.pximg.net', // booth
            's2.booth.pm', // booth
            'github.com', // GitHub
            'avatars.githubusercontent.com', // GitHub User Avatars
        ],
    },

    ogImage: {
        preset: 'avatio',
        secret: process.env.OG_IMAGE_SECRET,
        routes: {
            revoke: {
                requireToken: true,
            },
        },
    },

    pwa: {
        disable: import.meta.test,
        registerWebManifestInRouteRules: true,
        registerType: 'autoUpdate',
        manifest: {
            id: 'liria.avatio',
            name: title,
            short_name: title,
            description,
            theme_color: '#18181b',
            background_color: '#18181b',
            icons: [
                { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                {
                    src: 'maskable-icon-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                },
            ],
        },
        workbox: {
            runtimeCaching: [
                {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'google-fonts-cache',
                        expiration: {
                            maxEntries: 10,
                            maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
                        },
                        cacheableResponse: {
                            statuses: [0, 200],
                        },
                    },
                },
            ],
        },
        devOptions: {
            enabled: false,
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
        exclude: ['/welcome', '/on-maintenance', '/admin/**'],
        sources: ['/api/__sitemap__/urls'],
    },

    schemaOrg: {
        defaults: !import.meta.test,
        identity: defineOrganization({
            name: 'Liria',
            description: 'Creation Circle by Liry24',
            logo: {
                url: 'https://liria.me/avatar.png?s=460',
                width: 460,
                height: 460,
            },
            url: 'https://liria.me',
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
        componentIslands: true,
        nitroAutoImports: true,
    },

    $production: {
        nitro: {
            scheduledTasks: {
                '0 22 * * *': ['job:report'],
            },
        },

        scripts: {
            assets: {
                fallbackOnSrcOnBundleFail: true,
            },
            registry: {
                umamiAnalytics: {
                    websiteId: process.env.UMAMI_WEBSITE_ID,
                    trigger: 'onNuxtReady',
                },
            },
        },
    },
})
