<script lang="ts" setup>
import { useForm } from '@tanstack/vue-form'

type EditableOverride = AdminCatalogItemView & {
    pendingCategory: ItemCategory
}

const props = defineProps<{
    initialOverrides: AdminCatalogItemView[]
}>()

const toast = useToast()
const itemCategory = useItemCategory()
const categoryOptions = itemCategorySchema.options.map((value) => ({
    label: itemCategory[value].label,
    value,
}))

const toEditableOverrides = (items: AdminCatalogItemView[]): EditableOverride[] =>
    items.flatMap((item) =>
        item.manualCategoryOverride
            ? [{ ...item, pendingCategory: item.manualCategoryOverride }]
            : [],
    )

const overrideForm = useForm({
    defaultValues: {
        entries: toEditableOverrides(props.initialOverrides),
    },
    onSubmit: () => undefined,
})

const savingOverrides = reactive(new Set<string>())
const overrideErrors = reactive(new Map<string, string>())
const overrideList = useTemplateRef<HTMLElement>('overrideList')
const overrideSearch = useTemplateRef<HTMLElement>('overrideSearch')
const overrideAnnouncement = ref('')
const overrideId = useId()

const focusOverride = async (id?: string) => {
    await nextTick()
    const control = id
        ? overrideList.value?.querySelector<HTMLElement>(
              `[data-override-id="${CSS.escape(id)}"] [role="combobox"]`,
          )
        : overrideSearch.value?.querySelector<HTMLInputElement>('input')
    control?.focus()
}

const addOverride = (item: CatalogItemView) => {
    if (overrideForm.state.values.entries.some(({ id }) => id === item.id)) return
    overrideForm.pushFieldValue('entries', {
        ...item,
        manualCategoryOverride: null,
        pendingCategory: item.category,
    })
    void focusOverride(item.id)
    overrideAnnouncement.value = `Added ${item.name}.`
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
    overrideErrors.delete(entry.id)
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
        overrideErrors.set(entry.id, 'Category override save failed. Please try again.')
        toast.add({ title: 'Category override save failed', color: 'error' })
    } finally {
        savingOverrides.delete(entry.id)
        if (overrideErrors.has(entry.id)) void focusOverride(entry.id)
    }
}

const removeOverride = async (index: number) => {
    const entry = overrideForm.state.values.entries[index]
    if (!entry) return
    savingOverrides.add(entry.id)
    overrideErrors.delete(entry.id)
    try {
        await $fetch(`/api/admin/items/${entry.id}`, {
            method: 'PATCH',
            body: { categoryOverride: null },
        })
        overrideForm.setFieldValue('entries', (entries) =>
            entries.filter(({ id }) => id !== entry.id),
        )
        const entries = overrideForm.state.values.entries
        void focusOverride(entries[Math.min(index, entries.length - 1)]?.id)
        overrideAnnouncement.value = `Removed ${entry.name}.`
        toast.add({ title: 'Category override removed', color: 'success' })
    } catch (error) {
        console.error('Error removing category override:', error)
        overrideErrors.set(entry.id, 'Category override removal failed. Please try again.')
        toast.add({ title: 'Category override removal failed', color: 'error' })
    } finally {
        savingOverrides.delete(entry.id)
        if (overrideErrors.has(entry.id)) void focusOverride(entry.id)
    }
}

defineExpose({
    reset(items: AdminCatalogItemView[]) {
        overrideForm.reset({ entries: toEditableOverrides(items) })
        overrideErrors.clear()
    },
})
</script>

<template>
    <UPageCard
        title="Item category overrides"
        description="Search the existing Catalog, then save or remove each override independently."
        variant="subtle"
    >
        <div ref="overrideList" class="flex flex-col gap-3">
            <p role="status" aria-live="polite" aria-atomic="true" class="sr-only">
                {{ overrideAnnouncement }}
            </p>
            <div ref="overrideSearch">
                <CommandPaletteItemSearch
                    endpoint="/api/admin/items"
                    :allow-resolve="false"
                    @select="addOverride"
                />
            </div>

            <overrideForm.ArrayField v-slot="{ field }" name="entries">
                <fieldset
                    v-for="(entry, index) in field.value"
                    :key="entry.id"
                    :data-override-id="entry.id"
                    class="border-default grid min-w-0 items-center gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto]"
                >
                    <legend class="sr-only">{{ entry.name }}</legend>
                    <div class="flex min-w-0 items-center gap-3">
                        <UAvatar
                            :src="entry.image || undefined"
                            alt=""
                            :icon="getCatalogProviderData(entry.primarySource?.providerKey).icon"
                            size="md"
                            :ui="{ image: 'rounded-md' }"
                            class="rounded-md"
                        />
                        <div class="min-w-0">
                            <p class="truncate text-sm font-medium">{{ entry.name }}</p>
                            <p class="text-muted truncate text-xs">
                                {{ entry.primarySource?.publisher?.name || 'Unknown publisher' }}
                                ·
                                {{ getCatalogProviderData(entry.primarySource?.providerKey).label }}
                            </p>
                        </div>
                    </div>
                    <div>
                        <p class="text-muted text-xs">Current category</p>
                        <p class="text-sm">{{ itemCategory[entry.category].label }}</p>
                    </div>
                    <USelect
                        :aria-label="`Category for ${entry.name}`"
                        :aria-invalid="overrideErrors.has(entry.id)"
                        :aria-describedby="
                            overrideErrors.has(entry.id) ? `${overrideId}-${entry.id}` : undefined
                        "
                        :model-value="entry.pendingCategory"
                        :items="categoryOptions"
                        @update:model-value="setOverrideCategory(index, $event)"
                    />
                    <div class="flex gap-2 lg:justify-end">
                        <UButton
                            type="button"
                            icon="mingcute:save-2-line"
                            :aria-label="`Save category override for ${entry.name}`"
                            color="neutral"
                            :loading="savingOverrides.has(entry.id)"
                            @click="saveOverride(index)"
                        />
                        <UButton
                            type="button"
                            icon="mingcute:delete-2-line"
                            :aria-label="`Remove category override for ${entry.name}`"
                            color="error"
                            variant="soft"
                            :loading="savingOverrides.has(entry.id)"
                            @click="removeOverride(index)"
                        />
                    </div>
                    <p
                        v-if="overrideErrors.has(entry.id)"
                        :id="`${overrideId}-${entry.id}`"
                        role="alert"
                        class="text-error text-sm lg:col-span-4"
                    >
                        {{ overrideErrors.get(entry.id) }}
                    </p>
                </fieldset>
            </overrideForm.ArrayField>
        </div>
    </UPageCard>
</template>
