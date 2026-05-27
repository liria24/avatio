import { z } from 'zod'

const FLAGS_KEY = 'app'

const defaultAppFlags = {
    allowedBoothCategoryId: [],
    forceUpdateItem: false,
    isMaintenance: false,
    specificItemCategories: {
        booth: {},
        github: {},
    },
} satisfies AppFlags

const appFlagsSchema = z.object({
    allowedBoothCategoryId: z.number().int().array().default([]),
    forceUpdateItem: z.boolean().default(false),
    isMaintenance: z.boolean().default(false),
    specificItemCategories: z
        .object({
            booth: z.record(z.string(), itemCategorySchema).default({}),
            github: z.record(z.string(), itemCategorySchema).default({}),
        })
        .default({
            booth: {},
            github: {},
        }),
})

const appFlagsPatchSchema = appFlagsSchema.partial()

export const getAppFlags = defineCachedFunction(
    async (): Promise<AppFlags> => {
        const stored = await useStorage('flags').getItem(FLAGS_KEY)
        const parsed = appFlagsSchema.safeParse(stored)
        return parsed.success ? parsed.data : defaultAppFlags
    },
    {
        name: 'app-flags',
        maxAge: APP_FLAGS_CACHE_TTL,
        swr: false,
    },
)

export const updateAppFlags = async (patch: unknown) => {
    const parsedPatch = appFlagsPatchSchema.parse(patch)
    const current = await getAppFlags()
    const next = appFlagsSchema.parse({
        ...current,
        ...parsedPatch,
        specificItemCategories: {
            ...current.specificItemCategories,
            ...parsedPatch.specificItemCategories,
        },
    })

    await useStorage('flags').setItem(FLAGS_KEY, next)
    await useStorage('cache').del('nitro:functions:app-flags:.json')
    return next
}
