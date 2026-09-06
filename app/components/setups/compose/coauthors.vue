<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

const { coauthors, addCoauthor, removeCoauthor, setCoauthors, updateCoauthorNote } =
    useSetupCompose()
</script>

<template>
    <UFormField name="coauthors" :label="$t('setup.compose.coauthors.title')">
        <div class="flex flex-col gap-2">
            <VueDraggable
                :model-value="coauthors"
                :animation="150"
                handle=".draggable"
                drag-class="opacity-100"
                ghost-class="opacity-0"
                class="flex h-full w-full flex-col gap-2 empty:hidden"
                @update:model-value="setCoauthors"
            >
                <div
                    v-for="coauthor in coauthors"
                    :key="`coauthor-${coauthor.userId}`"
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
                                icon="mingcute:close-line"
                                variant="ghost"
                                size="xs"
                                @click="removeCoauthor(coauthor.userId)"
                            />
                        </div>
                        <UInput
                            :model-value="coauthor.note"
                            :placeholder="$t('setup.compose.coauthors.note')"
                            size="sm"
                            @update:model-value="updateCoauthorNote(coauthor.userId, $event)"
                        />
                    </div>
                </div>
            </VueDraggable>

            <UPopover :content="{ side: 'right', align: 'start' }">
                <UButton
                    icon="mingcute:add-line"
                    :label="
                        coauthors.length ? undefined : $t('setup.compose.coauthors.placeholder')
                    "
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
