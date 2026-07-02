<script setup lang="ts">
import type { SearchMatch, StoredFile } from 'files-sdk'
import type { FilesClient } from 'files-sdk/vue'

const props = defineProps<{
    files: FilesClient
    selectedKey?: string
}>()

const emit = defineEmits<{
    select: [file: StoredFile]
}>()

const query = ref('')
const match = ref<SearchMatch>('substring')
const caseInsensitive = ref(true)
const results = ref<StoredFile[]>([])
const pending = ref(false)
const errorMessage = ref<string>()

const matchItems = [
    { label: 'Substring', value: 'substring' },
    { label: 'Glob', value: 'glob' },
    { label: 'Regex', value: 'regex' },
    { label: 'Exact', value: 'exact' },
] satisfies { label: string; value: SearchMatch }[]

const formatSize = (size: number) =>
    new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(size)

const search = async () => {
    const pattern = query.value.trim()
    if (!pattern) {
        results.value = []
        errorMessage.value = undefined
        return
    }

    pending.value = true
    errorMessage.value = undefined

    try {
        const nextResults: StoredFile[] = []
        for await (const file of props.files.search(pattern, {
            match: match.value,
            caseInsensitive: caseInsensitive.value,
            maxResults: 50,
            limit: 100,
        }))
            nextResults.push(file)
        results.value = nextResults
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : 'Failed to search files.'
    } finally {
        pending.value = false
    }
}

const debouncedSearch = useDebounceFn(search, 300)

watch([query, match, caseInsensitive], () => {
    void debouncedSearch()
})
</script>

<template>
    <UPageCard variant="subtle" :ui="{ container: 'gap-2 p-3 sm:p-3' }" class="rounded-lg">
        <div class="flex flex-wrap items-center gap-2">
            <UInput
                v-model="query"
                icon="mingcute:search-line"
                placeholder="Search files..."
                variant="soft"
                size="sm"
                class="min-w-56 flex-1 rounded-lg"
                @keydown.enter="search"
            />
            <USelect
                v-model="match"
                :items="matchItems"
                value-key="value"
                label-key="label"
                size="sm"
                class="w-32 rounded-lg"
            />
            <UCheckbox v-model="caseInsensitive" label="Ignore case" size="sm" />
            <UButton
                icon="mingcute:search-line"
                variant="soft"
                color="neutral"
                size="sm"
                :loading="pending"
                @click="search"
            />
        </div>

        <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="mingcute:warning-fill"
            :description="errorMessage"
        />

        <div v-if="results.length" class="border-default max-h-52 overflow-auto rounded-md border">
            <button
                v-for="file in results"
                :key="file.key"
                type="button"
                class="hover:bg-elevated/60 border-default flex w-full items-center gap-3 border-b px-3 py-2 text-left text-xs last:border-b-0"
                :class="file.key === selectedKey && 'bg-primary/10'"
                @click="emit('select', file)"
            >
                <Icon name="mingcute:file-search-fill" class="text-muted size-4 shrink-0" />
                <span class="text-highlighted min-w-0 flex-1 truncate font-mono">
                    {{ file.key }}
                </span>
                <span class="text-muted font-mono">{{ formatSize(file.size) }}</span>
            </button>
        </div>
    </UPageCard>
</template>
