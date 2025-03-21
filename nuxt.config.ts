import tailwindcss from '@tailwindcss/vite';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    future: { compatibilityVersion: 4 },
    compatibilityDate: '2024-08-21',
    devtools: { enabled: true, timeline: { enabled: true } },
    modules: [
        'reka-ui/nuxt',
        '@vueuse/nuxt',
        '@nuxt/icon',
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
    routeRules: {
        '/': { isr: 60 },
        '/setup/edit': { ssr: false },
        '/faq': { isr: 600 },
        '/terms': { isr: 600 },
        '/privacy-policy': { isr: 600 },
    },
    css: ['~/assets/css/main.css'],
    nitro: {
        preset: 'vercel',
    },
    vite: {
        plugins: [tailwindcss()],
    },
    runtimeConfig: {
        public: { r2: { domain: '' } },
        turnstile: { siteKey: '', secretKey: '' },
        r2: { endpoint: '', accessKey: '', secretKey: '' },
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
                {
                    name: 'og:site_name',
                    property: 'og:site_name',
                    content: 'Avatio',
                },
                { name: 'og:type', property: 'og:type', content: 'website' },
                {
                    name: 'og:url',
                    property: 'og:url',
                    content: 'https://avatio.me',
                },
                { name: 'og:title', property: 'og:title', content: 'Avatio' },
                { name: 'twitter:site', content: '@liria_work' },
                { name: 'twitter:card', content: 'summary_large_image' },
            ],
        },
    },
    fonts: { families: [{ name: 'Murecho', provider: 'google' }] },
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
            const supabase = createClient<Database>(
                import.meta.env.SUPABASE_URL,
                import.meta.env.SUPABASE_ANON_KEY
            );

            const permanent = [
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
                .select('id, created_at, name, images:setup_images(name)')
                .order('created_at', { ascending: true });

            const setups = setupsError
                ? []
                : setupsData.map(
                      (setup: {
                          id: number;
                          created_at: string;
                          name: string;
                          images: { name: string }[];
                      }) => {
                          const image = setup.images[0]?.name;

                          return {
                              loc: `/setup/${setup.id}`,
                              lastmod: setup.created_at,
                              images: image
                                  ? [{ loc: image, title: setup.name }]
                                  : [],
                              changefreq: 'never',
                          };
                      }
                  );

            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id');

            const users = usersError
                ? []
                : usersData.map((user: { id: string }) => {
                      return { loc: `/@${user.id}` };
                  });

            return [...permanent, ...setups, ...users];
        },
    },
    supabase: {
        url: import.meta.env.SUPABASE_URL,
        key: import.meta.env.SUPABASE_ANON_KEY,
        serviceKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        redirect: true,
        redirectOptions: {
            login: '/login',
            callback: '/',
            include: ['/setup/edit', '/settings', '/bookmarks'],
            exclude: [],
            cookieRedirect: false,
        },
        clientOptions: {
            auth: {
                flowType: 'pkce',
            },
        },
        types: '@/shared/types/database.d.ts',
    },
    turnstile: { siteKey: import.meta.env.NUXT_TURNSTILE_SITE_KEY },
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
