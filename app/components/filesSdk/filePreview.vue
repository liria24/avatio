<script setup lang="ts">
import type { StoredFile } from 'files-sdk'
import type { FilesClient } from 'files-sdk/vue'

const props = defineProps<{
    files: FilesClient
    file?: StoredFile
}>()

const objectUrl = ref<string>()
const publicUrl = ref<string>()
const textPreview = ref<string>()
const pending = ref(false)
const errorMessage = ref<string>()

const isImage = computed(() => props.file?.type.startsWith('image/'))
const isText = computed(() => {
    const type = props.file?.type ?? ''
    return type.startsWith('text/') || type.includes('json') || type.includes('xml')
})

const fileDate = computed(() =>
    props.file?.lastModified ? new Date(props.file.lastModified).toLocaleString('en') : 'Unknown',
)

const fileSize = computed(() =>
    props.file
        ? new Intl.NumberFormat('en', {
              notation: 'compact',
              maximumFractionDigits: 1,
          }).format(props.file.size)
        : '',
)

const clearObjectUrl = () => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = undefined
}

const loadPreview = async () => {
    clearObjectUrl()
    publicUrl.value = undefined
    textPreview.value = undefined
    errorMessage.value = undefined

    if (!props.file) return

    pending.value = true
    try {
        publicUrl.value = await props.files.url(props.file.key)

        if (isImage.value) objectUrl.value = publicUrl.value
        else if (isText.value && props.file.size <= 128 * 1024) {
            const downloaded = await props.files.download(props.file.key, { as: 'blob' })
            textPreview.value = await downloaded.text()
        }
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : 'Failed to preview file.'
    } finally {
        pending.value = false
    }
}

watch(
    () => props.file?.key,
    () => {
        void loadPreview()
    },
    { immediate: true },
)

onBeforeUnmount(clearObjectUrl)
</script>

<template>
    <UPageCard
        variant="subtle"
        :ui="{ root: 'h-full min-h-0', container: 'h-full min-h-0 gap-3', body: 'min-h-0' }"
        class="rounded-lg"
    >
        <template #title>File Preview</template>

        <div v-if="!file" class="text-muted flex h-full items-center justify-center text-sm">
            Select a file to preview.
        </div>

        <div v-else class="flex h-full min-h-0 flex-col gap-3">
            <div class="flex items-start gap-3">
                <Icon name="mingcute:file-fill" class="text-muted mt-1 size-5 shrink-0" />
                <div class="min-w-0 flex-1">
                    <h2 class="text-highlighted truncate font-medium">{{ file.name }}</h2>
                    <p class="text-muted font-mono text-xs break-all">{{ file.key }}</p>
                </div>
            </div>

            <UAlert
                v-if="errorMessage"
                color="error"
                variant="soft"
                icon="mingcute:warning-fill"
                :description="errorMessage"
            />

            <div
                class="bg-default/70 border-default flex min-h-52 items-center justify-center overflow-hidden rounded-lg border"
            >
                <img
                    v-if="isImage && objectUrl"
                    :src="objectUrl"
                    :alt="file.name"
                    class="max-h-96 max-w-full object-contain"
                />
                <pre
                    v-else-if="textPreview"
                    class="size-full max-h-96 overflow-auto p-3 text-xs whitespace-pre-wrap"
                    >{{ textPreview }}</pre
                >
                <div v-else class="text-muted flex flex-col items-center gap-2 text-sm">
                    <Icon
                        :name="
                            pending ? 'svg-spinners:180-ring-with-bg' : 'mingcute:file-unknown-fill'
                        "
                        class="size-8"
                    />
                    <span>{{ pending ? 'Loading preview...' : 'Preview is not available.' }}</span>
                </div>
            </div>

            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                <dt class="text-muted">Type</dt>
                <dd class="text-highlighted min-w-0 truncate font-mono">
                    {{ file.type || 'Unknown' }}
                </dd>
                <dt class="text-muted">Size</dt>
                <dd class="text-highlighted font-mono">{{ fileSize }}</dd>
                <dt class="text-muted">Updated</dt>
                <dd class="text-highlighted font-mono">{{ fileDate }}</dd>
                <dt v-if="file.etag" class="text-muted">ETag</dt>
                <dd v-if="file.etag" class="text-highlighted min-w-0 truncate font-mono">
                    {{ file.etag }}
                </dd>
            </dl>

            <div class="mt-auto flex gap-2">
                <UButton
                    v-if="publicUrl"
                    :to="publicUrl"
                    target="_blank"
                    external
                    icon="mingcute:external-link-line"
                    label="Open"
                    variant="soft"
                    color="neutral"
                    size="sm"
                />
                <UButton
                    v-if="publicUrl"
                    :to="publicUrl"
                    download
                    external
                    icon="mingcute:download-line"
                    label="Download"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                />
            </div>
        </div>
    </UPageCard>
</template>
