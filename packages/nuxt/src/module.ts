import { resolve } from 'node:path'

import {
    addImportsDir,
    addServerHandler,
    addTemplate,
    addTypeTemplate,
    createResolver,
    defineNuxtModule,
    updateTemplates,
} from '@nuxt/kit'

import { loadContentPages } from './build/content'
import { deriveReservedRootPaths } from './build/routes'

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

        const contentTemplate = addTemplate({
            filename: 'avatio/content.mjs',
            write: true,
            getContents: async () => {
                const pages = await loadContentPages(contentDirectory, options.locales)
                return [
                    `export const contentPages = ${JSON.stringify(pages)}`,
                    `export const contentLocales = ${JSON.stringify(options.locales)}`,
                    `export const fallbackLocale = ${JSON.stringify(options.fallbackLocale)}`,
                ].join('\n')
            },
        })
        const routesTemplate = addTemplate({
            filename: 'avatio/reserved-root-paths.mjs',
            write: true,
            getContents: () =>
                `export const reservedRootPaths = new Set(${JSON.stringify(reservedRootPaths)})`,
        })

        nuxt.options.alias['#avatio/content'] = contentTemplate.dst
        nuxt.options.alias['#avatio/routes'] = routesTemplate.dst
        nuxt.options.watch.push(contentDirectory)

        addTypeTemplate(
            {
                filename: 'types/avatio-generated.d.ts',
                getContents: () => `
declare module '#avatio/content' {
    import type { AvatioSourceContentPage } from '@avatio/nuxt/runtime/content'
    export const contentPages: Record<string, AvatioSourceContentPage>
    export const contentLocales: string[]
    export const fallbackLocale: string
}

declare module '#avatio/routes' {
    export const reservedRootPaths: Set<string>
}
`,
            },
            { nitro: true, nuxt: true },
        )

        addImportsDir(resolver.resolve('./runtime/app/composables'))
        addServerHandler({
            route: '/api/avatio/content/:slug',
            handler: resolver.resolve('./runtime/server/api/content.get'),
        })

        nuxt.hook('pages:resolved', async (pages) => {
            reservedRootPaths = deriveReservedRootPaths(pages, options.locales)
            await updateTemplates({ filter: (template) => template.dst === routesTemplate.dst })
        })

        nuxt.hook('builder:watch', async (_event, path) => {
            if (!resolve(nuxt.options.rootDir, path).startsWith(contentDirectory)) return
            await updateTemplates({ filter: (template) => template.dst === contentTemplate.dst })
        })
    },
})
