<script lang="ts" setup>
import type { ProviderAdmissionDecision } from '@avatio/core/catalog'
import type { ProviderAdmissionConfig } from '@avatio/core/contracts'

defineProps<{
    providers: ProviderAdmissionConfig[]
}>()

const emit = defineEmits<{
    setDecision: [
        providerIndex: number,
        facetIndex: number,
        optionIndex: number,
        decision: ProviderAdmissionDecision,
    ]
    setConfiguredValues: [providerIndex: number, facetIndex: number, labels: string[]]
}>()

const facetLabel = (key: string) => key.replaceAll('-', ' ')
</script>

<template>
    <UPageCard
        v-for="(provider, providerIndex) in providers"
        :key="provider.providerKey"
        :title="getCatalogProviderData(provider.providerKey).label"
        :description="`An item is admitted when ${provider.match === 'any' ? 'any' : 'all'} configured facets match.`"
        variant="subtle"
    >
        <div class="flex flex-col gap-5">
            <fieldset
                v-for="(facet, facetIndex) in provider.facets"
                :key="facet.key"
                class="min-w-0 space-y-2"
            >
                <legend class="text-sm font-medium capitalize">
                    {{ facetLabel(facet.key) }}
                </legend>

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
                    :aria-label="`${getCatalogProviderData(provider.providerKey).label} ${facetLabel(facet.key)}`"
                    class="w-full"
                    @update:model-value="
                        emit('setConfiguredValues', providerIndex, facetIndex, $event)
                    "
                />

                <div v-else class="divide-default border-default divide-y rounded-lg border">
                    <div
                        v-for="(option, optionIndex) in facet.options"
                        :key="option.valueKey"
                        role="group"
                        :aria-label="option.label"
                        class="flex items-center gap-3 p-3"
                    >
                        <Icon
                            v-if="option.decision === null"
                            name="mingcute:warning-line"
                            size="18"
                            class="text-warning"
                        />
                        <span class="min-w-0 grow truncate text-sm">{{ option.label }}</span>
                        <UButton
                            type="button"
                            label="Allow"
                            :aria-pressed="option.decision === 'allow'"
                            size="xs"
                            color="success"
                            :variant="option.decision === 'allow' ? 'solid' : 'soft'"
                            @click="
                                emit('setDecision', providerIndex, facetIndex, optionIndex, 'allow')
                            "
                        />
                        <UButton
                            type="button"
                            label="Reject"
                            :aria-pressed="option.decision === 'deny'"
                            size="xs"
                            color="error"
                            :variant="option.decision === 'deny' ? 'solid' : 'soft'"
                            @click="
                                emit('setDecision', providerIndex, facetIndex, optionIndex, 'deny')
                            "
                        />
                    </div>
                </div>
            </fieldset>
        </div>
    </UPageCard>
</template>
