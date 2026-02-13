<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

const { createChangelog } = useAdminActions()
const toast = useToast()
const { t } = useI18n()

const { userData: me } = useCurrentUser()

const state = reactive({
    title: '',
    markdown: '',
    authors: [me.value?.username || ''],
})
const authors = ref<SerializedUser[]>([])

const addAuthor = (user: SerializedUser) => {
    if (!user?.username) return

    if (authors.value.some((author) => author.username === user.username)) {
        toast.add({
            title: t('admin.changelogsCompose.duplicateAuthor'),
            color: 'warning',
        })
        return
    }

    authors.value.push(user)
}

const removeAuthor = (username: string) => {
    const index = authors.value.findIndex((author) => author.username === username)
    if (index !== -1) authors.value.splice(index, 1)
}

watch(authors, (newAuthors) => {
    state.authors = newAuthors.map((author) => author.username)
})

const onSubmit = async () => {
    await createChangelog(state)
}

const resetForm = () => {
    state.title = ''
    state.markdown = ''
    state.authors = [me.value?.username || '']
    authors.value = []
    addAuthor(me.value!)
}

addAuthor(me.value!)
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
                                :key="`author-${author.username}`"
                                class="ring-accented flex items-stretch gap-2 rounded-md p-2 ring-1"
                            >
                                <div
                                    class="draggable hover:bg-elevated grid cursor-move rounded-md px-1 py-2 transition-colors"
                                >
                                    <Icon
                                        name="mingcute:dots-fill"
                                        size="18"
                                        class="text-muted shrink-0 self-center"
                                    />
                                </div>

                                <div class="flex grow items-center gap-2">
                                    <UAvatar
                                        :src="author.image || undefined"
                                        :alt="author.name || 'User'"
                                        icon="mingcute:user-3-fill"
                                        size="xs"
                                    />
                                    <span class="text-toned grow text-xs">
                                        {{ author.name }}
                                    </span>
                                    <UButton
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="xs"
                                        @click="removeAuthor(author.username)"
                                    />
                                </div>
                            </div>
                        </VueDraggable>

                        <UPopover :content="{ side: 'right', align: 'start' }">
                            <UButton
                                icon="mingcute:add-line"
                                :label="authors.length ? undefined : 'Add Author'"
                                variant="soft"
                            />

                            <template #content>
                                <CommandPaletteUserSearch @select="addAuthor" />
                            </template>
                        </UPopover>
                    </div>
                </UFormField>
            </UForm>
        </template>
    </UDashboardPanel>
</template>
