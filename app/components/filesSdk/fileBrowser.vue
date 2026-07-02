<script setup lang="ts">
import type { StoredFile } from 'files-sdk'
import type { FilesClient } from 'files-sdk/vue'

const props = defineProps<{
    files: FilesClient
    selectedKey?: string
}>()

const emit = defineEmits<{
    select: [file: StoredFile]
}>()

const prefix = ref('')
const items = ref<StoredFile[]>([])
const prefixes = ref<string[]>([])
const cursor = ref<string>()
const pending = ref(false)
const errorMessage = ref<string>()

const parentPrefix = computed(() => {
    if (!prefix.value) return undefined
    const segments = prefix.value.replace(/\/$/, '').split('/')
    segments.pop()
    return segments.length ? `${segments.join('/')}/` : ''
})

const breadcrumbs = computed(() => {
    const crumbs = [{ label: 'Root', prefix: '' }]
    let current = ''
    for (const segment of prefix.value.split('/').filter(Boolean)) {
        current += `${segment}/`
        crumbs.push({ label: segment, prefix: current })
    }
    return crumbs
})

const formatSize = (size: number) =>
    new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(size)

const getFolderName = (folderPrefix: string) =>
    folderPrefix.slice(0, -1).split('/').at(-1) || folderPrefix

const load = async (nextCursor?: string) => {
    pending.value = true
    errorMessage.value = undefined

    try {
        const result = await props.files.list({
            prefix: prefix.value || undefined,
            cursor: nextCursor,
            delimiter: '/',
            limit: 100,
        })

        if (nextCursor) {
            items.value = [...items.value, ...result.items]
            prefixes.value = [...prefixes.value, ...(result.prefixes ?? [])]
        } else {
            items.value = result.items
            prefixes.value = result.prefixes ?? []
        }
        cursor.value = result.cursor
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : 'Failed to load files.'
    } finally {
        pending.value = false
    }
}

const openPrefix = async (nextPrefix: string) => {
    prefix.value = nextPrefix
    await load()
}

const refresh = async () => await load()

watch(
    () => props.files,
    () => {
        void load()
    },
    { immediate: true },
)
</script>

<template>
    <UPageCard
        variant="subtle"
        :ui="{
            root: 'min-h-0 grow',
            container: 'h-full min-h-0 gap-2 p-0 sm:p-0',
            body: 'flex min-h-0 flex-col p-0 sm:p-0',
        }"
        class="overflow-hidden rounded-lg"
    >
        <template #header>
            <div class="flex items-center gap-2 p-3">
                <UButton
                    icon="mingcute:arrow-up-line"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    :disabled="parentPrefix === undefined"
                    @click="
                        () => {
                            if (parentPrefix !== undefined) void openPrefix(parentPrefix)
                        }
                    "
                />
                <UBreadcrumb
                    :items="
                        breadcrumbs.map((crumb) => ({
                            label: crumb.label,
                            onSelect: () => openPrefix(crumb.prefix),
                        }))
                    "
                    class="min-w-0 flex-1"
                />
                <UButton
                    icon="mingcute:refresh-2-line"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    :loading="pending"
                    @click="refresh"
                />
            </div>
        </template>

        <template #body>
            <UAlert
                v-if="errorMessage"
                color="error"
                variant="soft"
                icon="mingcute:warning-fill"
                :description="errorMessage"
                class="m-3"
            />

            <div v-else class="min-h-0 flex-1 overflow-auto">
                <div
                    v-if="!pending && !prefixes.length && !items.length"
                    class="text-muted flex h-full items-center justify-center text-sm"
                >
                    No files found.
                </div>

                <div v-else class="divide-default divide-y">
                    <button
                        v-for="folder in prefixes"
                        :key="folder"
                        type="button"
                        class="hover:bg-elevated/60 flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition"
                        @click="openPrefix(folder)"
                    >
                        <Icon name="mingcute:folder-fill" class="text-warning size-5 shrink-0" />
                        <span class="text-highlighted min-w-0 flex-1 truncate font-medium">
                            {{ getFolderName(folder) }}
                        </span>
                        <span class="text-muted text-xs">Folder</span>
                    </button>

                    <button
                        v-for="file in items"
                        :key="file.key"
                        type="button"
                        class="hover:bg-elevated/60 flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition"
                        :class="file.key === selectedKey && 'bg-primary/10'"
                        @click="emit('select', file)"
                    >
                        <Icon name="mingcute:file-fill" class="text-muted size-5 shrink-0" />
                        <div class="min-w-0 flex-1">
                            <p class="text-highlighted truncate font-medium">{{ file.name }}</p>
                            <p class="text-muted truncate font-mono text-[11px]">{{ file.key }}</p>
                        </div>
                        <span class="text-muted font-mono text-xs">{{
                            formatSize(file.size)
                        }}</span>
                    </button>
                </div>

                <div v-if="cursor" class="p-3">
                    <UButton
                        block
                        variant="soft"
                        color="neutral"
                        :loading="pending"
                        @click="load(cursor)"
                    >
                        Load more
                    </UButton>
                </div>
            </div>
        </template>
    </UPageCard>
</template>
