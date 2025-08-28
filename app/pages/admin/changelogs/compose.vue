<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

const { $session } = useNuxtApp()
const session = await $session()
const toast = useToast()

const me = await $fetch<UserWithSetups>(`/api/users/${session.value?.user.id}`)

const state = reactive({
    slug: '',
    title: '',
    markdown: '',
    authors: [me.id],
})
const authors = ref<User[]>([me])

const addAuthor = (user: User) => {
    if (!user?.id) return

    if (authors.value.some((author) => author.id === user.id)) {
        toast.add({
            title: '著者を重複して追加することはできません',
            color: 'warning',
        })
        return
    }

    authors.value.push(user)
}

const removeAuthor = (id: string) => {
    const index = authors.value.findIndex((author) => author.id === id)
    if (index !== -1) authors.value.splice(index, 1)
}

watch(authors, (newAuthors) => {
    state.authors = newAuthors.map((author) => author.id)
})

const onSubmit = async () => {
    try {
        await $fetch('/api/changelogs', {
            method: 'POST',
            body: state,
        })
        toast.add({
            title: 'Changelog created successfully',
            color: 'success',
        })
    } catch (error) {
        console.error(error)

        toast.add({
            title: 'Failed to create changelog',
            color: 'error',
        })
    }
}

const resetForm = () => {
    state.slug = ''
    state.title = ''
    state.markdown = ''
    state.authors = [me.id]
    authors.value = [me]
}
</script>

<template>
    <UForm :state class="flex max-w-lg flex-col gap-4" @submit="onSubmit">
        <UButton
            icon="lucide:rotate-ccw"
            label="Reset"
            variant="soft"
            @click="resetForm"
        />

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

        <UFormField name="authors" label="Authors">
            <div class="flex flex-col gap-2">
                <VueDraggable
                    v-model="authors"
                    :animation="150"
                    handle=".draggable"
                    drag-class="opacity-100"
                    ghost-class="opacity-0"
                    class="flex h-full w-full flex-col gap-2 empty:hidden"
                >
                    <div
                        v-for="author in authors"
                        :key="`author-${author.id}`"
                        class="ring-accented flex items-stretch gap-2 rounded-md p-2 ring-1"
                    >
                        <div
                            class="draggable hover:bg-elevated grid cursor-move rounded-md px-1 py-2 transition-colors"
                        >
                            <Icon
                                name="lucide:grip-vertical"
                                size="18"
                                class="text-muted shrink-0 self-center"
                            />
                        </div>

                        <div class="flex grow items-center gap-2">
                            <UAvatar
                                :src="author.image || undefined"
                                :alt="author.name || 'User'"
                                icon="lucide:user-round"
                                size="xs"
                            />
                            <span class="text-toned grow text-xs">
                                {{ author.name }}
                            </span>
                            <UButton
                                icon="lucide:x"
                                variant="ghost"
                                size="xs"
                                @click="removeAuthor(author.id)"
                            />
                        </div>
                    </div>
                </VueDraggable>

                <UPopover :content="{ side: 'right', align: 'start' }">
                    <UButton
                        icon="lucide:plus"
                        :label="authors.length ? undefined : 'Add Author'"
                        variant="soft"
                    />

                    <template #content>
                        <CommandPaletteUserSearch @select="addAuthor" />
                    </template>
                </UPopover>
            </div>
        </UFormField>

        <UButton type="submit" label="Submit" color="neutral" size="lg" block />
    </UForm>
</template>
