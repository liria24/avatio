<script lang="ts" setup>
import type { ProviderAdmissionDecision } from '@avatio/core/catalog'
import type { AppConfig, ProviderAdmissionConfig } from '@avatio/core/contracts'
import { useForm } from '@tanstack/vue-form'

const { saveAppConfig } = useAdmin()
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

const categoryOverrides = useTemplateRef<{ reset: (items: AdminCatalogItemView[]) => void }>(
    'categoryOverrides',
)

const reset = async () => {
    await Promise.all([refresh(), refreshOverrides()])
    admissionForm.reset({ providers: cloneAdmissions(data.value?.providerAdmissions ?? []) })
    categoryOverrides.value?.reset(overrideResponse.value?.data ?? [])
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
                        <AdminConfigProviderAdmissions
                            :providers="field.value"
                            @set-decision="setDecision"
                            @set-configured-values="setConfiguredValues"
                        />
                    </admissionForm.ArrayField>
                </form>

                <AdminConfigCategoryOverrides
                    ref="categoryOverrides"
                    :initial-overrides="overrideResponse?.data ?? []"
                />
            </div>
        </template>
    </UDashboardPanel>
</template>
