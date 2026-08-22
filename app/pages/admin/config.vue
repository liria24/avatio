<script lang="ts" setup>
type CategoryOverride = {
    key: number
    platform: Platform
    itemId: string
    category: ItemCategory
}

const { saveAppConfig } = useAdmin()
const toast = useToast()
const itemCategory = useItemCategory()

const categoryOptions = itemCategorySchema.options.map((value) => ({
    label: itemCategory[value].label,
    value,
}))
const platformOptions = [
    { label: 'Booth', value: 'booth' },
    { label: 'GitHub', value: 'github' },
] satisfies { label: string; value: Platform }[]

const state = reactive({
    isMaintenance: false,
    forceUpdateItem: false,
    allowedBoothCategoryId: [] as string[],
    categoryOverrides: [] as CategoryOverride[],
})

const validationError = ref<string | null>(null)
const saving = ref(false)
let nextOverrideKey = 0

const { data, status, refresh } = await useFetch<AppConfig>('/api/admin/config', {
    dedupe: 'defer',
})

const applyConfig = (config: AppConfig) => {
    state.isMaintenance = config.isMaintenance
    state.forceUpdateItem = config.forceUpdateItem
    state.allowedBoothCategoryId = config.allowedBoothCategoryId.map(String)
    state.categoryOverrides = Object.entries(config.specificItemCategories).flatMap(
        ([platform, categories]) =>
            Object.entries(categories).map(([itemId, category]) => ({
                key: nextOverrideKey++,
                platform: platform as Platform,
                itemId,
                category,
            })),
    )
}

if (data.value) applyConfig(data.value)

const addCategoryOverride = () => {
    state.categoryOverrides.push({
        key: nextOverrideKey++,
        platform: 'booth',
        itemId: '',
        category: 'other',
    })
}

const removeCategoryOverride = (key: number) => {
    state.categoryOverrides = state.categoryOverrides.filter((entry) => entry.key !== key)
}

const reset = async () => {
    await refresh()
    if (data.value) applyConfig(data.value)
    validationError.value = null
}

const createPayload = (): AppConfig | null => {
    const allowedBoothCategoryId = state.allowedBoothCategoryId.map((id) => Number(id.trim()))
    if (allowedBoothCategoryId.some((id) => !Number.isInteger(id))) {
        validationError.value = 'Allowed Booth category IDs must be integers.'
        return null
    }

    const specificItemCategories: AppConfig['specificItemCategories'] = {
        booth: {},
        github: {},
    }

    for (const entry of state.categoryOverrides) {
        const itemId = entry.itemId.trim()
        if (!itemId) {
            validationError.value = 'Item IDs in category overrides cannot be empty.'
            return null
        }
        if (specificItemCategories[entry.platform][itemId]) {
            validationError.value = `Duplicate category override: ${entry.platform}/${itemId}`
            return null
        }
        specificItemCategories[entry.platform][itemId] = entry.category
    }

    validationError.value = null
    return {
        allowedBoothCategoryId: [...new Set(allowedBoothCategoryId)],
        forceUpdateItem: state.forceUpdateItem,
        isMaintenance: state.isMaintenance,
        specificItemCategories,
    }
}

const save = async () => {
    const payload = createPayload()
    if (!payload) {
        toast.add({
            title: 'Invalid config',
            description: validationError.value || undefined,
            color: 'error',
        })
        return
    }

    saving.value = true
    try {
        const saved = await saveAppConfig(payload)
        if (saved) applyConfig(saved)
    } finally {
        saving.value = false
    }
}

useSeo({
    title: 'Admin - Config',
})
</script>

<template>
    <UDashboardPanel
        id="config"
        :ui="{
            body: 'gap-4 sm:gap-4 p-0 sm:p-0',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Config">
                <template #right>
                    <UButton
                        icon="mingcute:refresh-1-line"
                        label="Reset"
                        variant="soft"
                        :loading="status === 'pending'"
                        @click="reset"
                    />
                    <UButton
                        icon="mingcute:save-2-fill"
                        label="Save"
                        color="neutral"
                        :loading="saving"
                        @click="save"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div
                class="flex max-h-[calc(99dvh-var(--ui-header-height))] grow flex-col gap-4 p-3 sm:p-5"
            >
                <UAlert
                    icon="mingcute:information-line"
                    color="neutral"
                    variant="subtle"
                    title="D1 and Flagship persistence"
                    description="Category configuration is replaced atomically in D1. Runtime flags are evaluated by Cloudflare Flagship and fail closed when unavailable."
                    class="shrink-0"
                />

                <UAlert
                    v-if="validationError"
                    icon="mingcute:warning-line"
                    color="error"
                    variant="subtle"
                    title="Invalid config"
                    :description="validationError"
                />

                <UPageCard title="Runtime flags" variant="subtle">
                    <div class="flex flex-col gap-4">
                        <USwitch
                            v-model="state.isMaintenance"
                            label="Maintenance mode"
                            description="Managed in Cloudflare Flagship; this value is read-only here."
                            color="neutral"
                            disabled
                        />
                        <USwitch
                            v-model="state.forceUpdateItem"
                            label="Force update item info"
                            description="Managed in Cloudflare Flagship; this value is read-only here."
                            color="neutral"
                            disabled
                        />
                    </div>
                </UPageCard>

                <UPageCard
                    title="Allowed Booth category IDs"
                    description="Only Booth items in these categories can be resolved."
                    variant="subtle"
                >
                    <UInputTags
                        v-model="state.allowedBoothCategoryId"
                        add-on-blur
                        add-on-paste
                        placeholder="Add a numeric category ID"
                        class="w-full"
                        @add-tag="
                            state.allowedBoothCategoryId = [
                                ...state.allowedBoothCategoryId,
                                String($event),
                            ]
                        "
                        @remove-tag="
                            state.allowedBoothCategoryId = state.allowedBoothCategoryId.filter(
                                (id) => id !== $event,
                            )
                        "
                    />
                </UPageCard>

                <UPageCard
                    title="Item category overrides"
                    description="Override the resolved category for individual items."
                    variant="subtle"
                >
                    <div class="flex flex-col gap-3">
                        <div
                            v-for="entry in state.categoryOverrides"
                            :key="entry.key"
                            class="grid gap-2 sm:grid-cols-[10rem_1fr_12rem_auto]"
                        >
                            <USelect v-model="entry.platform" :items="platformOptions" />
                            <UInput v-model="entry.itemId" placeholder="Item ID" />
                            <USelect v-model="entry.category" :items="categoryOptions" />
                            <UButton
                                icon="mingcute:delete-2-line"
                                aria-label="Remove category override"
                                color="error"
                                variant="soft"
                                @click="removeCategoryOverride(entry.key)"
                            />
                        </div>

                        <UButton
                            icon="mingcute:add-line"
                            label="Add override"
                            variant="soft"
                            class="self-start"
                            @click="addCategoryOverride"
                        />
                    </div>
                </UPageCard>
            </div>
        </template>
    </UDashboardPanel>
</template>
