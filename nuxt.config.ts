import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY
);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-08-21',
    devtools: {
        enabled: true,
        timeline: {
            enabled: true,
        },
    },
    modules: [
        'radix-vue/nuxt',
        '@nuxt/ui',
        '@nuxtjs/tailwindcss',
        '@vueuse/nuxt',
        '@nuxt/image',
        '@nuxt/fonts',
        '@nuxtjs/color-mode',
        '@nuxtjs/supabase',
        '@nuxt/eslint',
        '@nuxt/scripts',
        '@nuxtjs/turnstile',
        '@nuxtjs/robots',
        '@nuxtjs/sitemap',
    ],
    imports: {
        dirs: ['types'],
    },
    routeRules: {
        '/': { isr: 60 },
        '/setup/edit': { ssr: false },
        '/faq': { prerender: true },
        '/terms': { prerender: true },
        '/privacy-policy': { prerender: true },
    },
    nitro: {
        preset: 'vercel',
    },
    runtimeConfig: {
        public: {
            r2: { domain: '' },
        },
        turnstile: {
            siteKey: '',
            secretKey: '',
        },
        r2: {
            endpoint: '',
            accessKey: '',
            secretKey: '',
        },
    },
    app: {
        head: {
            htmlAttrs: {
                lang: 'ja',
                prefix: 'og: https://ogp.me/ns#',
            },
            title: 'Avatio',
            link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.svg' }],
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1',
                },
                {
                    hid: 'description',
                    name: 'description',
                    content: 'あなたのアバター改変を共有しよう',
                },
                {
                    hid: 'icon',
                    name: 'icon',
                    content: '/favicon.svg',
                },
                {
                    hid: 'og:site_name',
                    property: 'og:site_name',
                    content: 'Avatio',
                },
                { hid: 'og:type', property: 'og:type', content: 'website' },
                {
                    hid: 'og:url',
                    property: 'og:url',
                    content: 'https://avatio.me',
                },
                {
                    hid: 'og:title',
                    property: 'og:title',
                    content: 'Avatio',
                },
                {
                    hid: 'og:description',
                    property: 'og:description',
                    content: 'あなたのアバター改変を共有しよう',
                },
                {
                    hid: 'og:image',
                    property: 'og:image',
                    content: '/ogp_2.png',
                },
                {
                    hid: 'twitter:title',
                    property: 'twitter:title',
                    content: 'Avatio',
                },
                {
                    hid: 'twitter:description',
                    property: 'twitter:description',
                    content: 'あなたのアバター改変を共有しよう',
                },
                {
                    hid: 'twitter:image',
                    property: 'twitter:image',
                    content: '/ogp_2.png',
                },
                { name: 'twitter:site', content: '@liria_work' },
                { name: 'twitter:card', content: 'summary_large_image' },
            ],
        },
    },
    fonts: {
        families: [{ name: 'Murecho', provider: 'google' }],
    },
    icon: {
        customCollections: [
            {
                prefix: 'avatio',
                dir: './public/icons/avatio',
            },
        ],

        clientBundle: {
            icons: [
                'lucide:search',
                'lucide:settings',
                'lucide:plus',
                'lucide:x',
                'lucide:check',
                'svg-spinners:ring-resize',
            ],
            scan: true,
            includeCustomCollections: true,
        },
    },
    image: {
        domains: [
            'booth.pximg.net', // booth
            import.meta.env.NUXT_PUBLIC_R2_DOMAIN.replace('https://', ''), // R2
        ],
        presets: {
            thumbnail: {
                modifiers: {
                    format: 'webp',
                    sizes: '300px',
                    quality: 85,
                    loading: 'lazy',
                    fit: 'cover',
                },
            },
            avatarThumbnail: {
                modifiers: {
                    format: 'webp',
                    sizes: '80px',
                    quality: 80,
                    loading: 'lazy',
                    fit: 'cover',
                },
            },
        },
    },
    robots: {
        allow: ['Twitterbot', 'facebookexternalhit'],
        blockNonSeoBots: true,
        blockAiBots: true,
    },
    sitemap: {
        sitemaps: true,
        exclude: [
            '/confirm',
            '/login',
            '/search',
            '/setup/edit',
            '/settings',
            '/bookmarks',
        ],
        urls: async () => {
            const permament = [
                {
                    loc: '/',
                    images: [
                        {
                            loc: '/ogp.png',
                            changefreq: 'never',
                            title: 'Avatio',
                        },
                    ],
                },
                {
                    loc: '/faq',
                    images: [
                        { loc: '/ogp.png', changefreq: 'never', title: 'FAQ' },
                    ],
                },
                {
                    loc: '/terms',
                    images: [
                        {
                            loc: '/ogp.png',
                            changefreq: 'never',
                            title: '利用規約',
                        },
                    ],
                },
                {
                    loc: '/privacy-policy',
                    images: [
                        {
                            loc: '/ogp.png',
                            changefreq: 'never',
                            title: 'プライバシーポリシー',
                        },
                    ],
                },
            ];

            const { data: setupsData, error: setupsError } = await supabase
                .from('setups')
                .select('id, created_at, name, image')
                .order('created_at', { ascending: true });

            const setups = setupsError
                ? []
                : setupsData.map((setup) => {
                      const image = setup.image;

                      return {
                          loc: `/setup/${setup.id}`,
                          lastmod: setup.created_at,
                          images: image
                              ? [{ loc: image, title: setup.name }]
                              : [],
                          changefreq: 'never',
                      };
                  });

            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id');

            const users = usersError
                ? []
                : usersData.map((user) => {
                      return { loc: `/@${user.id}` };
                  });

            return [...permament, ...setups, ...users];
        },
    },
    supabase: {
        url: import.meta.env.SUPABASE_URL,
        key: import.meta.env.SUPABASE_ANON_KEY,
        serviceKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        redirect: true,
        redirectOptions: {
            login: '/login',
            callback: '/confirm',
            include: ['/setup/edit', '/settings', '/bookmarks'],
            exclude: [],
            cookieRedirect: false,
        },
        types: './types/database.ts',
    },
    turnstile: {
        siteKey: import.meta.env.NUXT_TURNSTILE_SITE_KEY,
    },
});

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
