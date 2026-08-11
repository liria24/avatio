import { z } from 'zod'

const FLAGS_KEY = 'app'

let maintenanceFlagCache: { value: boolean; expiresAt: number } | null = null

export const defaultAppFlags = {
    allowedBoothCategoryId: [],
    forceUpdateItem: false,
    isMaintenance: false,
    specificItemCategories: {
        booth: {},
        github: {},
    },
} satisfies AppFlags

export const appFlagsSchema = z.object({
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

export const appFlagsPatchSchema = z.object({
    allowedBoothCategoryId: z.number().int().array().optional(),
    forceUpdateItem: z.boolean().optional(),
    isMaintenance: z.boolean().optional(),
    specificItemCategories: z
        .object({
            booth: z.record(z.string(), itemCategorySchema).optional(),
            github: z.record(z.string(), itemCategorySchema).optional(),
        })
        .optional(),
})

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

export const getMaintenanceFlag = async () => {
    const now = Date.now()
    if (maintenanceFlagCache && maintenanceFlagCache.expiresAt > now)
        return maintenanceFlagCache.value

    const { isMaintenance } = await getAppFlags()
    maintenanceFlagCache = {
        value: isMaintenance,
        expiresAt: now + APP_FLAGS_CACHE_TTL * 1000,
    }
    return isMaintenance
}

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
    maintenanceFlagCache = null
    await useStorage('cache').del('nitro:functions:app-flags:.json')
    return next
}
