<script lang="ts" setup>
import type { ProviderAdmissionDecision } from '@avatio/core/catalog'
import type { AppConfig, ProviderAdmissionConfig } from '@avatio/core/contracts'
import { useForm } from '@tanstack/vue-form'

type EditableOverride = AdminCatalogItemView & {
    pendingCategory: ItemCategory
}

const { saveAppConfig } = useAdmin()
const toast = useToast()
const itemCategory = useItemCategory()
const categoryOptions = itemCategorySchema.options.map((value) => ({
    label: itemCategory[value].label,
    value,
}))
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

const cloneAdmissions = (providers: ProviderAdmissionConfig[]) =>
    providers.map((provider) => ({
        ...provider,
        facets: provider.facets.map((facet) => ({
            ...facet,
            options: facet.options.map((option) => ({ ...option })),
        })),
    }))
const toEditableOverrides = (items: AdminCatalogItemView[]) =>
    items.flatMap((item) =>
        item.manualCategoryOverride
            ? [{ ...item, pendingCategory: item.manualCategoryOverride }]
            : [],
    )

const admissionForm = useForm({
    defaultValues: {
        providers: cloneAdmissions(data.value?.providerAdmissions ?? []),
    },
    onSubmit: async ({ value, formApi }) => {
        const saved = await saveAppConfig({
            providerAdmissionRules: value.providers.flatMap((provider) =>
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
        if (saved) formApi.reset({ providers: cloneAdmissions(saved.providerAdmissions) })
    },
})
const overrideForm = useForm({
    defaultValues: {
        entries: toEditableOverrides(overrideResponse.value?.data ?? []),
    },
    onSubmit: () => undefined,
})
const savingOverrides = reactive(new Set<string>())

const reset = async () => {
    await Promise.all([refresh(), refreshOverrides()])
    admissionForm.reset({ providers: cloneAdmissions(data.value?.providerAdmissions ?? []) })
    overrideForm.reset({ entries: toEditableOverrides(overrideResponse.value?.data ?? []) })
}

const updateAdmissions = (update: (providers: ProviderAdmissionConfig[]) => void) => {
    const providers = cloneAdmissions(admissionForm.state.values.providers)
    update(providers)
    admissionForm.setFieldValue('providers', providers)
}

const setDecision = (
    providerIndex: number,
    facetIndex: number,
    optionIndex: number,
    decision: ProviderAdmissionDecision,
) => {
    updateAdmissions((providers) => {
        const option = providers[providerIndex]?.facets[facetIndex]?.options[optionIndex]
        if (option) option.decision = decision
    })
}

const setConfiguredValues = (providerIndex: number, facetIndex: number, labels: string[]) => {
    updateAdmissions((providers) => {
        const facet = providers[providerIndex]?.facets[facetIndex]
        if (!facet) return
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
    })
}

const addOverride = (item: CatalogItemView) => {
    if (overrideForm.state.values.entries.some(({ id }) => id === item.id)) return
    overrideForm.pushFieldValue('entries', {
        ...item,
        manualCategoryOverride: null,
        pendingCategory: item.category,
    })
}

const setOverrideCategory = (index: number, pendingCategory: ItemCategory) => {
    overrideForm.setFieldValue('entries', (entries) =>
        entries.map((entry, candidate) =>
            candidate === index ? { ...entry, pendingCategory } : entry,
        ),
    )
}

const saveOverride = async (index: number) => {
    const entry = overrideForm.state.values.entries[index]
    if (!entry) return
    savingOverrides.add(entry.id)
    try {
        const item = await $fetch<AdminCatalogItemView>(`/api/admin/items/${entry.id}`, {
            method: 'PATCH',
            body: { categoryOverride: entry.pendingCategory },
        })
        overrideForm.setFieldValue('entries', (entries) =>
            entries.map((candidate) =>
                candidate.id === item.id
                    ? {
                          ...item,
                          pendingCategory: item.manualCategoryOverride ?? item.category,
                      }
                    : candidate,
            ),
        )
        toast.add({ title: 'Category override saved', color: 'success' })
    } catch (error) {
        console.error('Error saving category override:', error)
        toast.add({ title: 'Category override save failed', color: 'error' })
    } finally {
        savingOverrides.delete(entry.id)
    }
}

const removeOverride = async (index: number) => {
    const entry = overrideForm.state.values.entries[index]
    if (!entry) return
    savingOverrides.add(entry.id)
    try {
        await $fetch(`/api/admin/items/${entry.id}`, {
            method: 'PATCH',
            body: { categoryOverride: null },
        })
        overrideForm.setFieldValue('entries', (entries) =>
            entries.filter(({ id }) => id !== entry.id),
        )
        toast.add({ title: 'Category override removed', color: 'success' })
    } catch (error) {
        console.error('Error removing category override:', error)
        toast.add({ title: 'Category override removal failed', color: 'error' })
    } finally {
        savingOverrides.delete(entry.id)
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
                    <admissionForm.Subscribe
                        v-slot="formState"
                        :selector="
                            (state) => ({
                                canSubmit: state.canSubmit,
                                isDefaultValue: state.isDefaultValue,
                                isSubmitting: state.isSubmitting,
                            })
                        "
                    >
                        <UButton
                            form="provider-admission-form"
                            type="submit"
                            icon="mingcute:save-2-fill"
                            label="Save admission"
                            color="neutral"
                            :disabled="formState.isDefaultValue || !formState.canSubmit"
                            :loading="formState.isSubmitting"
                        />
                    </admissionForm.Subscribe>
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

                <form
                    id="provider-admission-form"
                    class="contents"
                    @submit.prevent="admissionForm.handleSubmit()"
                >
                    <admissionForm.ArrayField v-slot="{ field }" name="providers">
                        <UPageCard
                            v-for="(provider, providerIndex) in field.value"
                            :key="provider.providerKey"
                            :title="getCatalogProviderData(provider.providerKey).label"
                            :description="`An item is admitted when ${provider.match === 'any' ? 'any' : 'all'} configured facets match.`"
                            variant="subtle"
                        >
                            <div class="flex flex-col gap-5">
                                <section
                                    v-for="(facet, facetIndex) in provider.facets"
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
                                        @update:model-value="
                                            setConfiguredValues(providerIndex, facetIndex, $event)
                                        "
                                    />

                                    <div
                                        v-else
                                        class="divide-default border-default divide-y rounded-lg border"
                                    >
                                        <div
                                            v-for="(option, optionIndex) in facet.options"
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
                                                type="button"
                                                label="Allow"
                                                size="xs"
                                                color="success"
                                                :variant="
                                                    option.decision === 'allow' ? 'solid' : 'soft'
                                                "
                                                @click="
                                                    setDecision(
                                                        providerIndex,
                                                        facetIndex,
                                                        optionIndex,
                                                        'allow',
                                                    )
                                                "
                                            />
                                            <UButton
                                                type="button"
                                                label="Reject"
                                                size="xs"
                                                color="error"
                                                :variant="
                                                    option.decision === 'deny' ? 'solid' : 'soft'
                                                "
                                                @click="
                                                    setDecision(
                                                        providerIndex,
                                                        facetIndex,
                                                        optionIndex,
                                                        'deny',
                                                    )
                                                "
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </UPageCard>
                    </admissionForm.ArrayField>
                </form>

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

                        <overrideForm.ArrayField v-slot="{ field }" name="entries">
                            <div
                                v-for="(entry, index) in field.value"
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
                                                getCatalogProviderData(
                                                    entry.primarySource?.providerKey,
                                                ).label
                                            }}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-muted text-xs">Current category</p>
                                    <p class="text-sm">{{ itemCategory[entry.category].label }}</p>
                                </div>
                                <USelect
                                    :model-value="entry.pendingCategory"
                                    :items="categoryOptions"
                                    @update:model-value="setOverrideCategory(index, $event)"
                                />
                                <div class="flex gap-2 lg:justify-end">
                                    <UButton
                                        type="button"
                                        icon="mingcute:save-2-line"
                                        aria-label="Save category override"
                                        color="neutral"
                                        :loading="savingOverrides.has(entry.id)"
                                        @click="saveOverride(index)"
                                    />
                                    <UButton
                                        type="button"
                                        icon="mingcute:delete-2-line"
                                        aria-label="Remove category override"
                                        color="error"
                                        variant="soft"
                                        :loading="savingOverrides.has(entry.id)"
                                        @click="removeOverride(index)"
                                    />
                                </div>
                            </div>
                        </overrideForm.ArrayField>
                    </div>
                </UPageCard>
            </div>
        </template>
    </UDashboardPanel>
</template>
