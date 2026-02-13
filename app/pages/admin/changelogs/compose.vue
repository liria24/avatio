<script setup lang="ts">
const { createChangelog } = useAdminActions()

const state = reactive({
    title: '',
    markdown: '',
})

const onSubmit = async () => {
    await createChangelog(state)
}

const resetForm = () => {
    state.title = ''
    state.markdown = ''
}
</script>

<template>
    <UDashboardPanel id="changelogs-compose">
        <template #header>
            <UDashboardNavbar title="Changelogs | Compose">
                <template #right>
                    <UButton
                        icon="mingcute:refresh-1-line"
                        label="Reset"
                        variant="soft"
                        @click="resetForm"
                    />
                    <UButton
                        icon="mingcute:upload-fill"
                        label="Submit"
                        color="neutral"
                        loading-auto
                        @click="onSubmit"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UForm :state class="flex grow flex-col gap-4" @submit="onSubmit">
                <UFormField name="title" label="Title" required class="border-muted border-b-2">
                    <UInput
                        v-model="state.title"
                        placeholder="Enter title"
                        size="xl"
                        variant="none"
                        class="w-full"
                    />
                </UFormField>
                <UFormField
                    name="markdown"
                    label="Markdown"
                    required
                    :ui="{ container: 'grow flex flex-col' }"
                    class="flex grow flex-col"
                >
                    <TextEditor v-model="state.markdown" class="grow" />
                </UFormField>
            </UForm>
        </template>
    </UDashboardPanel>
</template>
