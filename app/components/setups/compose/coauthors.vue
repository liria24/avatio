<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

interface Model {
    user: Pick<SerializedUser, 'username' | 'name' | 'image'>
    note?: string | null
}
const coauthors = defineModel<Model[]>({
    default: () => [],
})

const toast = useToast()

const addCoauthor = (user: SerializedUser) => {
    if (!user?.username) return

    if (coauthors.value.some((coauthor) => coauthor.user.username === user.username)) {
        toast.add({
            title: '共同作者を重複して追加することはできません',
            color: 'warning',
        })
        return
    }

    coauthors.value.push({
        user,
        note: '',
    })
}

const removeCoauthor = (username: string) => {
    const index = coauthors.value.findIndex((coauthor) => coauthor.user.username === username)
    if (index !== -1) {
        coauthors.value.splice(index, 1)
    }
}
</script>

<template>
    <UFormField name="coauthors" label="共同作者">
        <div class="flex flex-col gap-2">
            <VueDraggable
                v-model="coauthors"
                :animation="150"
                handle=".draggable"
                drag-class="opacity-100"
                ghost-class="opacity-0"
                class="flex h-full w-full flex-col gap-2 empty:hidden"
            >
                <div
                    v-for="coauthor in coauthors"
                    :key="`coauthor-${coauthor.user.username}`"
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

                    <div class="flex grow flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <UAvatar
                                :src="coauthor.user.image || undefined"
                                :alt="coauthor.user.name || 'User'"
                                icon="lucide:user-round"
                                size="xs"
                            />
                            <span class="text-toned grow text-xs">
                                {{ coauthor.user.name }}
                            </span>
                            <UButton
                                icon="lucide:x"
                                variant="ghost"
                                size="xs"
                                @click="removeCoauthor(coauthor.user.username)"
                            />
                        </div>
                        <UInput v-model="coauthor.note" placeholder="ノート" size="sm" />
                    </div>
                </div>
            </VueDraggable>

            <UPopover :content="{ side: 'right', align: 'start' }">
                <UButton
                    icon="lucide:plus"
                    :label="coauthors.length ? undefined : '共同作者を追加'"
                    variant="soft"
                    block
                />

                <template #content>
                    <CommandPaletteUserSearch @select="addCoauthor" />
                </template>
            </UPopover>
        </div>
    </UFormField>
</template>
