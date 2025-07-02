<script setup lang="ts">
const state = reactive({
    slug: '',
    title: '',
    markdown: '',
})

const onSubmit = async () => {
    await $fetch('/api/changelogs', {
        method: 'POST',
        body: state,
    })
}
</script>

<template>
    <UForm :state class="flex max-w-lg flex-col gap-4" @submit="onSubmit">
        <UFormField name="slug" label="Slug" required>
            <UInput
                v-model="state.slug"
                placeholder="Enter slug"
                class="w-full"
            />
        </UFormField>
        <UFormField name="title" label="Title" required>
            <UInput
                v-model="state.title"
                placeholder="Enter title"
                class="w-full"
            />
        </UFormField>
        <UFormField name="markdown" label="Markdown" required>
            <UTextarea
                v-model="state.markdown"
                autoresize
                :rows="10"
                class="w-full"
            />
        </UFormField>
        <UButton type="submit" label="Submit" color="neutral" size="lg" block />
    </UForm>
</template>
