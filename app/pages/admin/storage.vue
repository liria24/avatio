<script setup lang="ts">
import type { StoredFile } from 'files-sdk'
import { useFiles } from 'files-sdk/vue'

const files = useFiles({ endpoint: '/api/admin/files' })
const selectedFile = ref<StoredFile>()

const selectFile = (file: StoredFile) => {
    selectedFile.value = file
}

useSeo({
    title: 'Admin - Storage',
})
</script>

<template>
    <UDashboardPanel id="storage" :ui="{ body: 'p-0 sm:p-0 min-h-0' }" class="max-w-[100qw]">
        <template #header>
            <UDashboardNavbar title="Storage" />
        </template>

        <template #body>
            <div class="grid min-h-0 grow gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <div class="flex min-h-0 flex-col gap-2">
                    <FilesSdkFileSearch
                        :files="files"
                        :selected-key="selectedFile?.key"
                        @select="selectFile"
                    />
                    <FilesSdkFileBrowser
                        :files="files"
                        :selected-key="selectedFile?.key"
                        @select="selectFile"
                    />
                </div>

                <FilesSdkFilePreview :files="files" :file="selectedFile" class="min-h-96" />
            </div>
        </template>
    </UDashboardPanel>
</template>
