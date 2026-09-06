import { resolve } from 'node:path'

import {
    addImportsDir,
    addTemplate,
    addTypeTemplate,
    createResolver,
    defineNuxtModule,
    updateTemplates,
} from '@nuxt/kit'

import { derivePageRoutePolicy } from './build/routes'

export interface AvatioNuxtModuleOptions {
    contentDirectory: string
    locales: string[]
    fallbackLocale: string
}

export default defineNuxtModule<AvatioNuxtModuleOptions>({
    meta: {
        name: '@avatio/nuxt',
        configKey: 'avatio',
    },
    defaults: {
        contentDirectory: 'content',
        locales: ['ja', 'en'],
        fallbackLocale: 'ja',
    },
    setup(options, nuxt) {
        const resolver = createResolver(import.meta.url)
        const contentDirectory = resolve(nuxt.options.rootDir, options.contentDirectory)
        let reservedRootPaths: string[] = []
        let staticPagePaths: string[] = []

        const contentConfigTemplate = addTemplate({
            filename: 'avatio/content-config.mjs',
            write: true,
            getContents: () =>
                `export const contentConfig = ${JSON.stringify({
                    contentDirectory: nuxt.options.dev ? contentDirectory : '',
                    locales: options.locales,
                    fallbackLocale: options.fallbackLocale,
                })}`,
        })
        const routesTemplate = addTemplate({
            filename: 'avatio/reserved-root-paths.mjs',
            write: true,
            getContents: () =>
                [
                    `export const reservedRootPaths = new Set(${JSON.stringify(reservedRootPaths)})`,
                    `export const staticPagePaths = new Set(${JSON.stringify(staticPagePaths)})`,
                    `export const routeLocales = ${JSON.stringify(options.locales)}`,
                ].join('\n'),
        })

        nuxt.options.alias['#avatio/content-config'] = contentConfigTemplate.dst
        nuxt.options.alias['#avatio/routes'] = routesTemplate.dst

        addTypeTemplate(
            {
                filename: 'types/avatio-generated.d.ts',
                getContents: () => `
declare module '#avatio/content-config' {
    export const contentConfig: { contentDirectory: string; locales: string[]; fallbackLocale: string }
}

declare module '#avatio/routes' {
    export const reservedRootPaths: Set<string>
    export const staticPagePaths: Set<string>
    export const routeLocales: string[]
}
`,
            },
            { nitro: true, nuxt: true },
        )

        addImportsDir(resolver.resolve('./runtime/app/composables'))

        nuxt.hook('pages:resolved', async (pages) => {
            const policy = derivePageRoutePolicy(
                [
                    ...pages,
                    { path: '/api/avatio/content' },
                    { path: nuxt.options.app.buildAssetsDir },
                ],
                options.locales,
            )
            reservedRootPaths = policy.rootPaths
            staticPagePaths = policy.staticPaths
            await updateTemplates({ filter: (template) => template.dst === routesTemplate.dst })
        })
    },
})
