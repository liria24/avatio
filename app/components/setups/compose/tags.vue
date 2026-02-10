<script lang="ts" setup>
const { state, addTag, removeTag } = useSetupCompose()
</script>

<template>
    <UFormField name="tags" :label="$t('setup.compose.tags.title')">
        <div class="flex flex-wrap items-center gap-2">
            <UBadge
                v-for="tag in state.tags"
                :key="tag"
                :label="tag"
                variant="soft"
                class="py-1 pr-1 pl-3"
            >
                <template #trailing>
                    <UButton
                        icon="mingcute:close-line"
                        variant="ghost"
                        size="xs"
                        @click="removeTag(tag)"
                    />
                </template>
            </UBadge>

            <UPopover :content="{ side: 'right', align: 'start' }">
                <UButton
                    icon="mingcute:add-line"
                    :label="state.tags.length ? undefined : $t('setup.compose.tags.add')"
                    variant="soft"
                />

                <template #content>
                    <CommandPaletteTagSearch @select="addTag" />
                </template>
            </UPopover>
        </div>
    </UFormField>
</template>
