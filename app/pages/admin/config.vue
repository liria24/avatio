<script lang="ts" setup>
import type {
    AppConfig,
    ProviderAdmissionConfig,
    ProviderAdmissionFacetConfig,
} from '@avatio/core/contracts'

type EditableOverride = AdminCatalogItemView & {
    pendingCategory: ItemCategory
    saving?: boolean
}

const { saveAppConfig } = useAdmin()
const toast = useToast()
const itemCategory = useItemCategory()
const categoryOptions = itemCategorySchema.options.map((value) => ({
    label: itemCategory[value].label,
    value,
}))
const state = reactive({
    providerAdmissions: [] as ProviderAdmissionConfig[],
    overrides: [] as EditableOverride[],
})
const saving = ref(false)

const { data, status, refresh } = await useFetch<AppConfig>('/api/admin/config', {
    dedupe: 'defer',
})
const {
    data: overrideResponse,
    status: overrideStatus,
    refresh: refreshOverrides,
} = await useFetch<PaginationResponse<AdminCatalogItemView[]>>('/api/admin/items', {
    dedupe: 'defer',
    query: { manualCategoryOverride: true },
})

const applyConfig = (config: AppConfig) => {
    state.providerAdmissions = config.providerAdmissions.map((provider) => ({
        ...provider,
        facets: provider.facets.map((facet) => ({
            ...facet,
            options: facet.options.map((option) => ({ ...option })),
        })),
    }))
}
const applyOverrides = (items: AdminCatalogItemView[]) => {
    state.overrides = items.flatMap((item) =>
        item.manualCategoryOverride
            ? [{ ...item, pendingCategory: item.manualCategoryOverride }]
            : [],
    )
}
if (data.value) applyConfig(data.value)
if (overrideResponse.value) applyOverrides(overrideResponse.value.data)

const reset = async () => {
    await Promise.all([refresh(), refreshOverrides()])
    if (data.value) applyConfig(data.value)
    if (overrideResponse.value) applyOverrides(overrideResponse.value.data)
}

const save = async () => {
    saving.value = true
    try {
        const saved = await saveAppConfig({
            providerAdmissionRules: state.providerAdmissions.flatMap((provider) =>
                provider.facets.flatMap((facet) =>
                    facet.options.flatMap((option) =>
                        option.decision
                            ? [
                                  {
                                      providerKey: provider.providerKey,
                                      facetKey: facet.key,
                                      valueKey: option.valueKey,
                                      label: option.label,
                                      decision: option.decision,
                                  },
                              ]
                            : [],
                    ),
                ),
            ),
        })
        if (saved) applyConfig(saved)
    } finally {
        saving.value = false
    }
}

const setConfiguredValues = (facet: ProviderAdmissionFacetConfig, labels: string[]) => {
    const existing = new Map(facet.options.map((option) => [option.label, option]))
    const now = new Date().toISOString()
    facet.options = [...new Set(labels.map((label) => label.trim()).filter(Boolean))].map(
        (label) =>
            existing.get(label) ?? {
                valueKey: label,
                label,
                decision: 'allow',
                firstSeenAt: now,
                lastSeenAt: now,
            },
    )
}

const addOverride = (item: CatalogItemView) => {
    if (state.overrides.some(({ id }) => id === item.id)) return
    state.overrides.push({
        ...item,
        manualCategoryOverride: null,
        pendingCategory: item.category,
    })
}

const saveOverride = async (entry: EditableOverride) => {
    entry.saving = true
    try {
        const item = await $fetch<AdminCatalogItemView>(`/api/admin/items/${entry.id}`, {
            method: 'PATCH',
            body: { categoryOverride: entry.pendingCategory },
        })
        Object.assign(entry, item, {
            pendingCategory: item.manualCategoryOverride ?? item.category,
        })
        toast.add({ title: 'Category override saved', color: 'success' })
    } catch (error) {
        console.error('Error saving category override:', error)
        toast.add({ title: 'Category override save failed', color: 'error' })
    } finally {
        entry.saving = false
    }
}

const removeOverride = async (entry: EditableOverride) => {
    entry.saving = true
    try {
        await $fetch(`/api/admin/items/${entry.id}`, {
            method: 'PATCH',
            body: { categoryOverride: null },
        })
        state.overrides = state.overrides.filter(({ id }) => id !== entry.id)
        toast.add({ title: 'Category override removed', color: 'success' })
    } catch (error) {
        console.error('Error removing category override:', error)
        toast.add({ title: 'Category override removal failed', color: 'error' })
        entry.saving = false
    }
}

const facetLabel = (key: string) => key.replaceAll('-', ' ')

useSeo({ title: 'Admin - Config' })
</script>

<template>
    <UDashboardPanel id="config" :ui="{ body: 'gap-4 sm:gap-4 p-0 sm:p-0' }">
        <template #header>
            <UDashboardNavbar title="Config">
                <template #right>
                    <UButton
                        icon="mingcute:refresh-1-line"
                        label="Reset"
                        variant="soft"
                        :loading="status === 'pending' || overrideStatus === 'pending'"
                        @click="reset"
                    />
                    <UButton
                        icon="mingcute:save-2-fill"
                        label="Save admission"
                        color="neutral"
                        :loading="saving"
                        @click="save"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div
                class="flex max-h-[calc(99dvh-var(--ui-header-height))] grow flex-col gap-4 overflow-y-auto p-3 sm:p-5"
            >
                <UAlert
                    icon="mingcute:information-line"
                    color="neutral"
                    variant="subtle"
                    title="D1 and Flagship persistence"
                    description="Provider admission rules are stored in D1. Runtime flags are evaluated by Cloudflare Flagship and fail closed when unavailable."
                    class="shrink-0"
                />

                <UPageCard title="Runtime flags" variant="subtle">
                    <USwitch
                        :model-value="data?.isMaintenance"
                        label="Maintenance mode"
                        description="Managed in Cloudflare Flagship; this value is read-only here."
                        color="neutral"
                        disabled
                    />
                </UPageCard>

                <UPageCard
                    v-for="provider in state.providerAdmissions"
                    :key="provider.providerKey"
                    :title="getCatalogProviderData(provider.providerKey).label"
                    :description="`An item is admitted when ${provider.match === 'any' ? 'any' : 'all'} configured facets match.`"
                    variant="subtle"
                >
                    <div class="flex flex-col gap-5">
                        <section
                            v-for="facet in provider.facets"
                            :key="facet.key"
                            class="space-y-2"
                        >
                            <h3 class="text-sm font-medium capitalize">
                                {{ facetLabel(facet.key) }}
                            </h3>

                            <UInputTags
                                v-if="facet.discovery === 'configured-only'"
                                :model-value="
                                    facet.options
                                        .filter(({ decision }) => decision === 'allow')
                                        .map(({ label }) => label)
                                "
                                add-on-blur
                                add-on-paste
                                :placeholder="`Add ${facetLabel(facet.key)}`"
                                class="w-full"
                                @update:model-value="setConfiguredValues(facet, $event)"
                            />

                            <div
                                v-else
                                class="divide-default border-default divide-y rounded-lg border"
                            >
                                <div
                                    v-for="option in facet.options"
                                    :key="option.valueKey"
                                    class="flex items-center gap-3 p-3"
                                >
                                    <Icon
                                        v-if="option.decision === null"
                                        name="mingcute:warning-line"
                                        size="18"
                                        class="text-warning"
                                    />
                                    <span class="min-w-0 grow truncate text-sm">{{
                                        option.label
                                    }}</span>
                                    <UButton
                                        label="Allow"
                                        size="xs"
                                        color="success"
                                        :variant="option.decision === 'allow' ? 'solid' : 'soft'"
                                        @click="option.decision = 'allow'"
                                    />
                                    <UButton
                                        label="Reject"
                                        size="xs"
                                        color="error"
                                        :variant="option.decision === 'deny' ? 'solid' : 'soft'"
                                        @click="option.decision = 'deny'"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                </UPageCard>

                <UPageCard
                    title="Item category overrides"
                    description="Search the existing Catalog, then save or remove each override independently."
                    variant="subtle"
                >
                    <div class="flex flex-col gap-3">
                        <CommandPaletteItemSearch
                            endpoint="/api/admin/items"
                            :allow-resolve="false"
                            @select="addOverride"
                        />

                        <div
                            v-for="entry in state.overrides"
                            :key="entry.id"
                            class="border-default grid items-center gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto]"
                        >
                            <div class="flex min-w-0 items-center gap-3">
                                <UAvatar
                                    :src="entry.image || undefined"
                                    alt=""
                                    :icon="
                                        getCatalogProviderData(entry.primarySource?.providerKey)
                                            .icon
                                    "
                                    size="md"
                                    :ui="{ image: 'rounded-md' }"
                                    class="rounded-md"
                                />
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">{{ entry.name }}</p>
                                    <p class="text-muted truncate text-xs">
                                        {{
                                            entry.primarySource?.publisher?.name ||
                                            'Unknown publisher'
                                        }}
                                        ·
                                        {{
                                            getCatalogProviderData(entry.primarySource?.providerKey)
                                                .label
                                        }}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p class="text-muted text-xs">Current category</p>
                                <p class="text-sm">{{ itemCategory[entry.category].label }}</p>
                            </div>
                            <USelect v-model="entry.pendingCategory" :items="categoryOptions" />
                            <div class="flex gap-2 lg:justify-end">
                                <UButton
                                    icon="mingcute:save-2-line"
                                    aria-label="Save category override"
                                    color="neutral"
                                    :loading="entry.saving"
                                    @click="saveOverride(entry)"
                                />
                                <UButton
                                    icon="mingcute:delete-2-line"
                                    aria-label="Remove category override"
                                    color="error"
                                    variant="soft"
                                    :loading="entry.saving"
                                    @click="removeOverride(entry)"
                                />
                            </div>
                        </div>
                    </div>
                </UPageCard>
            </div>
        </template>
    </UDashboardPanel>
</template>
