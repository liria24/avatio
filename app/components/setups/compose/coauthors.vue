<script lang="ts" setup>
const { coauthors, addCoauthor, removeCoauthor, setCoauthors, updateCoauthorNote } =
    useSetupCompose()
const { t } = useI18n()
const root = useTemplateRef<HTMLElement>('root')
const adding = ref(false)
const addedId = ref<string>()
const announcement = ref('')

const moveCoauthor = (index: number, direction: -1 | 1) => {
    const next = [...coauthors.value]
    const to = index + direction
    const coauthor = next[index]
    if (!coauthor || to < 0 || to >= next.length) return
    next.splice(index, 1)
    next.splice(to, 0, coauthor)
    setCoauthors(next)
    announcement.value = t('reorder.position', {
        name: coauthor.user.name,
        position: to + 1,
        count: next.length,
    })
}
const remove = async (index: number) => {
    const coauthor = coauthors.value[index]
    if (!coauthor) return
    removeCoauthor(coauthor.userId)
    await nextTick()
    const next = coauthors.value[Math.min(index, coauthors.value.length - 1)]
    const selector = next
        ? `[data-coauthor-id="${CSS.escape(next.userId)}"] [data-remove]`
        : '[data-add-coauthor]'
    root.value?.querySelector<HTMLElement>(selector)?.focus()
    announcement.value = t('dynamicFields.removed', { name: coauthor.user.name })
}
const add = (user: Serialized<User>) => {
    const exists = coauthors.value.some(({ userId }) => userId === user.id)
    addCoauthor(user)
    if (!exists && coauthors.value.some(({ userId }) => userId === user.id)) {
        addedId.value = user.id
        adding.value = false
    }
}
const focusAdded = (event: Event) => {
    if (!addedId.value) return
    const input = root.value?.querySelector<HTMLInputElement>(
        `[data-coauthor-id="${CSS.escape(addedId.value)}"] input`,
    )
    addedId.value = undefined
    if (!input) return
    event.preventDefault()
    input.focus()
}
</script>

<template>
    <fieldset ref="root" class="min-w-0">
        <legend class="text-default mb-1 block text-sm font-medium">
            {{ $t('setup.compose.coauthors.title') }}
        </legend>
        <p role="status" aria-live="polite" aria-atomic="true" class="sr-only">
            {{ announcement }}
        </p>
        <div class="flex flex-col gap-2">
            <SortableList
                :model-value="coauthors"
                handle=".draggable"
                class="flex h-full w-full flex-col gap-2 empty:hidden"
                @update:model-value="setCoauthors"
            >
                <div
                    v-for="(coauthor, index) in coauthors"
                    :key="`coauthor-${coauthor.userId}`"
                    :data-coauthor-id="coauthor.userId"
                    role="group"
                    :aria-label="coauthor.user.name"
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

                    <div class="flex grow flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <UAvatar
                                :src="coauthor.user.image || undefined"
                                :alt="coauthor.user.name || 'User'"
                                icon="mingcute:user-3-fill"
                                size="xs"
                            />
                            <span class="text-toned grow text-xs">
                                {{ coauthor.user.name }}
                            </span>
                            <UButton
                                :aria-label="
                                    $t('dynamicFields.remove', { name: coauthor.user.name })
                                "
                                data-remove
                                icon="mingcute:close-line"
                                variant="ghost"
                                size="xs"
                                @click="remove(index)"
                            />
                            <ReorderControls
                                :name="coauthor.user.name"
                                :index="index"
                                :count="coauthors.length"
                                @move="moveCoauthor(index, $event)"
                            />
                        </div>
                        <UInput
                            :model-value="coauthor.note"
                            :placeholder="$t('setup.compose.coauthors.note')"
                            :aria-label="$t('dynamicFields.noteFor', { name: coauthor.user.name })"
                            size="sm"
                            @update:model-value="updateCoauthorNote(coauthor.userId, $event)"
                        />
                    </div>
                </div>
            </SortableList>

            <UPopover
                v-model:open="adding"
                :content="{ side: 'right', align: 'start', onCloseAutoFocus: focusAdded }"
            >
                <UButton
                    data-add-coauthor
                    :aria-label="$t('setup.compose.coauthors.placeholder')"
                    icon="mingcute:add-line"
                    :label="
                        coauthors.length ? undefined : $t('setup.compose.coauthors.placeholder')
                    "
                    variant="soft"
                    color="neutral"
                    block
                />

                <template #content>
                    <CommandPaletteUserSearch @select="add" />
                </template>
            </UPopover>
        </div>
    </fieldset>
</template>
