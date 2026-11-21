<script setup lang="ts" generic="TData extends object">
import type { ContextMenuItem, SelectItem, TableColumn, TableRow } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
    const { class: _, ...rest } = attrs
    return rest
})

interface Props {
    data?: TData[] | null
    columns: TableColumn<TData>[]
    loading?: boolean
    filterOptions?: SelectItem[]
    refresh?: () => Promise<void> | void
    getRowContextMenuItems?: (row: TableRow<TData>) => ContextMenuItem[][]
    selectable?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    selectable: true,
})

const UCheckbox = resolveComponent('UCheckbox')

const filter = defineModel<string[]>('filter', { default: () => [] })
const rowSelection = defineModel<Record<string, boolean>>('rowSelection', { default: () => ({}) })
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const inputValue = ref(searchQuery.value)
const syncSearchQuery = useDebounceFn(() => {
    searchQuery.value = inputValue.value
}, 300)

const selectedCount = computed(() => Object.values(rowSelection.value).filter(Boolean).length)

const allColumns = computed<TableColumn<TData>[]>(() => {
    if (!props.selectable) return props.columns
    return [
        {
            id: 'select',
            header: ({ table }) =>
                h(UCheckbox, {
                    modelValue: table.getIsSomePageRowsSelected()
                        ? 'indeterminate'
                        : table.getIsAllPageRowsSelected(),
                    'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
                        table.toggleAllPageRowsSelected(!!value),
                    'aria-label': 'Select all',
                }),
            cell: ({ row }) =>
                h(UCheckbox, {
                    modelValue: row.getIsSelected(),
                    'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
                        row.toggleSelected(!!value),
                    'aria-label': 'Select row',
                }),
        },
        ...props.columns,
    ]
})

const contextMenuItems = ref<ContextMenuItem[][]>([])

const onSelect = (_e: Event, row: TableRow<TData>) => {
    row.toggleSelected(!row.getIsSelected())
}

const onContextmenu = (_e: Event, row: TableRow<TData>) => {
    if (props.getRowContextMenuItems) contextMenuItems.value = props.getRowContextMenuItems(row)
}

const tableRef = useTemplateRef('table')
defineExpose({ table: tableRef })
</script>

<template>
    <div class="flex flex-col gap-2" :class="$attrs.class">
        <div class="mt-3 flex items-center gap-1 px-3">
            <UBadge
                v-if="selectedCount > 0"
                icon="mingcute:check-line"
                :label="selectedCount"
                variant="soft"
                size="lg"
                :ui="{ leadingIcon: 'size-4' }"
                class="rounded-lg"
            />

            <USelect
                v-if="filterOptions?.length"
                v-model="filter"
                :items="filterOptions"
                multiple
                placeholder="Filter"
                icon="mingcute:filter-fill"
                size="sm"
                class="min-w-28 rounded-lg"
            >
                <span>Filter</span>
            </USelect>

            <UInput
                v-model="inputValue"
                icon="mingcute:search-line"
                placeholder="Search..."
                variant="soft"
                size="sm"
                class="rounded-lg"
                @update:model-value="syncSearchQuery"
            />

            <slot name="toolbar" />

            <UButton
                v-if="refresh"
                loading-auto
                icon="mingcute:refresh-2-line"
                variant="ghost"
                size="sm"
                class="ml-auto"
                @click="refresh()"
            />
        </div>

        <UContextMenu :items="contextMenuItems">
            <UTable
                ref="table"
                v-model:row-selection="rowSelection"
                :data="data ?? undefined"
                :columns="allColumns"
                :loading
                sticky
                :virtualize="{ estimateSize: 30 }"
                :ui="{ td: 'py-3 text-xs' }"
                v-bind="attrsWithoutClass"
                class="grow"
                @select="onSelect"
                @contextmenu="onContextmenu"
            >
                <template v-for="(_, name) in $slots" :key="name" v-slot:[name]="slotProps">
                    <slot :name="name" v-bind="slotProps ?? {}" />
                </template>
            </UTable>
        </UContextMenu>
    </div>
</template>
